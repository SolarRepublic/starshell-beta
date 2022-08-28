import type {
	AppToSpotter,
	IcsToService,
} from './messages';

import type {Vocab} from '#/meta/vocab';
import {microtask} from '#/util/belt';
import { buffer_to_hex } from '#/util/data';

const h_handlers_keplr = {
	async enable(a_args) {
		return void 0;
	},

	async getKey(a_args) {
		const si_chain = a_args[0];

		if(si_chain && 'string' === typeof si_chain) {
			return {
				return: {
					// address: '__uint8array__'+buffer_to_hex(atu8_address),
					address: '__uint8array__77e79e84acbb0c5033b4fff06d726bda303d6681',
					algo: 'secp256k1',
					bech32Address: 'secret1wlneap9vhvx9qva5llcx6untmgcr6e5p3dku0f',
					isNanoLedger: false,
					name: 'test',
					// pubKey: '__uint8array__'+buffer_to_hex(atu8_pubkey),
					pubKey: '__uint8array__0243f392236db2d586fbf7c9b47a45d72bfdb215b47c0931a86ba51db04f07f674',
				},
			};
		}
	},
};

/**
 * The spotter's sole purpose is to silently forward advertisement requests from the page to the service.
 */
(function() {
	// ref and cast runtime
	const d_runtime: Vocab.TypedRuntime<IcsToService.PublicVocab> = chrome.runtime;

	// verbose
	const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.ics-spotter: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	// prep handler map
	const h_handlers_window: Vocab.Handlers<AppToSpotter.WindowVocab> = {
		// window is requesting advertismement
		async requestAdvertisement() {
			// verbose
			debug('Processing #requestAdvertisement');

			// let service worker decide what to do
			await d_runtime.sendMessage({
				type: 'requestAdvertisement',
			});
		},

		// keplr events
		...{
			async 'proxy-request'(g_data) {
				const {
					args: a_args,
					id: si_request,
					method: si_method,
				} = g_data;


				const f_keplr = h_handlers_keplr[si_method];
				if(f_keplr) {
					const w_result = await f_keplr(a_args);

					window.postMessage({
						id: si_request,
						result: w_result,
						type: 'proxy-request-response',
					});
				}
			},
		},
	};

	// start listening for messages
	(window as Vocab.TypedWindow<AppToSpotter.WindowVocab>).addEventListener('message', (d_event) => {
		// verbose
		debug('Observed window message %o', d_event);

		// originates from same frame
		if(window === d_event.source) {
			// access event data
			const z_data = d_event.data;

			// data item conforms
			let si_type;
			if(z_data && 'object' === typeof z_data && 'string' === typeof (si_type=z_data.type)) {
				// ref handler
				const f_handler = h_handlers_window[si_type];

				// ignore all other messages
				if(!f_handler) return;

				// handler is registered; execute it
				debug(`Received relay port message having registered type %o`, z_data);
				f_handler(z_data);
			}
		}
	});



	const {
		locate_script,
	} = inline_require('./utils.ts');

	async function polyfill_keplr() {
		// create another script element to load the relay application
		const dm_script = document.createElement('script');

		// locate keplr script
		const p_keplr = locate_script('assets/src/script/mcs-keplr');

		// not found
		if(!p_keplr) {
			throw new Error('Unable to locate keplr script!');
		}

		// set the script src
		dm_script.src = chrome.runtime.getURL(p_keplr);

		// import as module
		dm_script.type = 'module';

		// wait for head/body to be constructed
		let c_retries = 0;
		while(!document.body) {
			c_retries++;
			await microtask();
			if(c_retries > 10000) break;
		}

		// append container element to the live document to initialize iframe's content document
		try {
			document.head.append(dm_script);
		}
		// browser didn't like adding content to head; fallback to using body
		catch(e_append) {
			document.body.append(dm_script);
		}
	}

	void polyfill_keplr();
})();
