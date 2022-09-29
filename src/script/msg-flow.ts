import type {IntraExt} from './messages';
import type {Vocab} from '#/meta/vocab';
import type {Dict, JsonObject} from '#/meta/belt';
import type {FlowMessage} from '#/entry/flow';

import {stringify_params, uuid_v4} from '#/util/dom';
import {OpenWindowConfig, open_window, PopoutWindowHandle} from '#/extension/browser';
import {PulseMonitor} from '#/util/pulse-monitor';
import {B_MOBILE, B_WEBEXT_ACTION, B_WEBEXT_BROWSER_ACTION} from '#/share/constants';


type FlowResponseValue<gc_prompt extends PromptConfig> = Vocab.Response<IntraExt.FlowVocab, gc_prompt['flow']['type']>;

export interface PromptConfig extends JsonObject {
	flow: FlowMessage;
	open?: OpenWindowConfig | undefined;
}

export class RegisteredFlowError extends Error {
	constructor(public detail: IntraExt.FlowError) {
		super(`${detail.type}: ${detail.value}`);
	}
}

async function launch_flow(h_params: Dict, gc_open?: OpenWindowConfig): Promise<PopoutWindowHandle> {
	// get flow URL
	const p_flow = chrome.runtime.getURL('src/entry/flow.html');

	// verbose
	console.debug(`Opening flow %o`, {
		params: h_params,
		open: gc_open,
	});

	// indicate via query params method of communication
	const p_connect = p_flow+'?'+stringify_params(h_params);

	// open connect window
	return await open_window(p_connect, gc_open);
}

export function open_flow_query<
	gc_prompt extends PromptConfig=PromptConfig,
	w_response extends FlowResponseValue<gc_prompt>=FlowResponseValue<gc_prompt>,
>(gc_prompt: gc_prompt): Promise<IntraExt.CompletedFlow | IntraExt.ErroredFlow> {
	// go async
	return new Promise(async(fk_resolve, fe_reject) => {
		// create response key
		const si_key = uuid_v4();

		// open port listener
		const f_port_listener = (d_port: Vocab.TypedChromePort<IntraExt.FlowControlAckVocab, IntraExt.FlowControlVocab>) => {
			// target port connected
			if(si_key === d_port.name) {
				// remove port listener now that the target port has been acquired
				chrome.runtime.onConnect.removeListener(f_port_listener);

				// verbose
				console.warn(`Service accepted connection from ${d_port.name}`);

				let b_flow_responded = false;

				// handle shutdown
				function shutdown() {
					// verbose
					console.warn(`Service noticed flow closed ${si_key}. Responded: ${b_flow_responded}`);

					// cancel monitor
					k_monitor.cancel();

					// flow never responded; equivalent to a cancelled flow
					if(!b_flow_responded) {
						fk_resolve({
							answer: false,
						});
					}
				}

				// create pulse monitor
				const k_monitor = new PulseMonitor({
					// allow up to 500ms between heartbeat messages (scheduled to send 200ms apart)
					grace: 5e3,

					// other end of port went dormant
					tardy() {
						console.warn(`Shutting down dormant port ${d_port.name}`);

						// shutdown the port
						d_port.disconnect();

						// listener does not fire on this side of the port, call shutdown
						shutdown();
					},
				});

				// message handlers
				const h_handlers: Vocab.Handlers<IntraExt.FlowControlVocab> = {
					// expect a continuous heartbeat message
					heartbeat() {
						k_monitor.pulse();
					},

					// flow is requesting to retransmit the parameters
					retransmit() {
						debugger;
						// d_port.postMessage(gc_prompt.flow);
					},

					// successful flow response
					completeFlow(g_response) {
						// do not invoke close handler
						b_flow_responded = true;

						// ack
						d_port.postMessage({
							type: 'completeFlowAck',
						});

						// verbose
						console.debug(`Service received completeFlow message: %o`, g_response);

						// complete flow
						fk_resolve(g_response);
					},

					reportError(s_detail) {
						// do not invoke close handler
						b_flow_responded = true;

						// ack
						d_port.postMessage({
							type: 'completeFlowAck',
						});

						// complete flow
						fk_resolve({
							error: s_detail,
						});
					},
				};

				d_port.onMessage.addListener((g_msg) => {
					// verbose
					if('heartbeat' !== g_msg.type) {
						console.debug(`Service received non-heartbeat flow message over port: %o`, g_msg);
					}

					// lookup handler
					const f_handler = h_handlers[g_msg.type];
					if(!f_handler) {
						console.warn(`Unable to route message from flow: '${g_msg.type}'`);
						return;
					}

					// route message
					// @ts-expect-error complicated typing
					f_handler(g_msg.value);  // eslint-disable-line @typescript-eslint/no-unsafe-argument
				});

				// register disconnect listener
				d_port.onDisconnect.addListener(shutdown);
			}
			else {
				console.warn(`Service noticed port connection from ${d_port.name}`);
			}
		};

		console.log(`Service monitoring for port connections from ${si_key}`);

		// register connect listener
		chrome.runtime.onConnect.addListener(f_port_listener);

		// launch flow
		await launch_flow({
			comm: 'query',
			key: si_key,
			data: JSON.stringify(gc_prompt.flow),
		}, gc_prompt.open);
	});
}

const h_lanes: Dict<{
	time: number;
	port: chrome.runtime.Port | null;
	queue: VoidFunction[];
	clear: VoidFunction;
}> = {};

export async function open_flow<
	gc_prompt extends PromptConfig=PromptConfig,
	w_response extends FlowResponseValue<gc_prompt>=FlowResponseValue<gc_prompt>,
>(gc_prompt: gc_prompt): Promise<IntraExt.CompletedFlow | IntraExt.ErroredFlow> {
	// flow originates from tab
	const i_tab = gc_prompt.flow.page?.tabId;
	const g_lane = i_tab? h_lanes[i_tab] = h_lanes[i_tab] || {time:0, queue:[]}: void 0;
	if(g_lane) {
		// same tab already has a flow opened
		if(g_lane.time) {
			// 
			console.warn(`${new URL((await chrome.tabs.get(i_tab!)).url!).host} tab now has ${g_lane.queue.length+1} queued flows`);

			// add to queue
			await new Promise<void>((fk_resolve) => {
				g_lane.queue.push(fk_resolve);
			});
		}

		function tab_removed(i_removed) {
			if(i_removed === i_tab) {
				g_lane!.clear();
			}
		}

		function tab_update(i_updated, g_changed) {
			if(i_updated === i_tab && (g_changed.status || g_changed.url)) {
				g_lane!.clear();
			}
		}

		chrome.tabs.onRemoved.addListener(tab_removed);
		chrome.tabs.onUpdated.addListener(tab_update);

		// set lane clear function
		g_lane.clear = () => {
			// verbose
			console.debug(`Clearing lane for ${gc_prompt.flow.page?.href}`);

			// remove listeners
			chrome.tabs.onRemoved.removeListener(tab_removed);
			chrome.tabs.onUpdated.removeListener(tab_update);

			// reset timer
			g_lane.time = 0;

			// fire up next in queue
			g_lane.queue.shift()?.();
		};

		// flow is now happening
		g_lane.time = Date.now();
	}

	// prep response
	let w_response: IntraExt.CompletedFlow | IntraExt.ErroredFlow;

	// on mobile and able to open popups
	if(i_tab && B_MOBILE && (B_WEBEXT_ACTION || B_WEBEXT_BROWSER_ACTION)) {
		gc_prompt.open = {
			...gc_prompt.open,
			popover: gc_prompt.flow.page!,
		};
	}

	// cannot create windows, fallback to query method
	if(!chrome.windows?.create) {
		w_response = await open_flow_query(gc_prompt);
	}
	// otherwise prefer broadcast method
	else {
		w_response = await open_flow_query(gc_prompt);
		// w_response = await open_flow_broadcast(gc_prompt, si_req);
	}

	// clear lane
	g_lane?.clear();

	return w_response;
}
