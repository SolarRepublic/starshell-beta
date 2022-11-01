import type {
	AppToSpotter,
	IcsToService,
	ServiceToIcs,
} from './messages';

import type {Vocab} from '#/meta/vocab';

import type * as ImportHelper from './ics-spotter-imports';

/**
 * The spotter's sole purpose is to silently forward advertisement requests from the page to the service.
 */
(function() {
	// ref and cast runtime
	const d_runtime: Vocab.TypedRuntime<IcsToService.PublicVocab, ServiceToIcs.CommandVocab> = chrome.runtime;

	// verbose
	const debug = (s: string, ...a_args: (string | number | object)[]) => console.debug(`StarShell.ics-spotter: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	const {
		SI_STORE_ACCOUNTS,
		B_FIREFOX_ANDROID,

		pubkey_to_bech32,

		create_app_profile,
		load_app_pfp,

		Apps,

		dd, qsa,
		stringify_params,

		create_store_class,
		WritableStoreMap,

		Vault,
	} = inline_require('./ics-spotter-imports.ts') as typeof ImportHelper;


	const XL_WIDTH_OVERLAY_MAX = 160;
	const XL_WIDTH_OVERLAY_MIN = 120;
	const XS_IDEAL_OVERLAY = 0.27;

	// prep handler map
	const h_handlers_window: Vocab.Handlers<AppToSpotter.WindowVocab> = {
		// window is requesting advertismement
		async requestAdvertisement() {
			// verbose
			debug('Processing #requestAdvertisement');

			// let service worker decide what to do
			await d_runtime.sendMessage({
				type: 'requestAdvertisement',
				value: {
					profile: await create_app_profile(),
				},
			});
		},
	};

	// listen for messages from app
	(window as Vocab.TypedWindow<AppToSpotter.WindowVocab>).addEventListener('message', (d_event) => {
		// // verbose
		// debug('Observed window message %o', d_event);

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

	// // Firefox on Android
	// if(B_FIREFOX_ANDROID) {
	// 	interface PopoverFields {
	// 		shadow: ShadowRoot;
	// 		iframe: HTMLIFrameElement;
	// 	}

	// 	const hm_privates = new WeakMap<Popover, PopoverFields>();

	// 	// define popover element
	// 	class Popover extends HTMLElement {
	// 		constructor() {
	// 			super();

	// 			const d_shadow = this.attachShadow({
	// 				mode: 'closed',
	// 			});

	// 			const dm_iframe = dd('iframe', {
	// 				src: 'about:blank',
	// 			});

	// 			d_shadow.append(dm_iframe);

	// 			hm_privates.set(this, {
	// 				shadow: d_shadow,
	// 				iframe: dm_iframe,
	// 			});
	// 		}

	// 		attributeChangedCallback(si_attr, s_old, s_new) {
	// 			if('params' === si_attr) {
	// 				hm_privates.get(this)!.iframe.src = chrome.runtime.getURL(`src/entry/flow.html?${s_new}`);
	// 			}
	// 		}
	// 	}

	// 	window.customElements.define('starshell-popover', Popover);

	// 	// listen for commands from service
	// 	d_runtime.onMessage.addListener((g_msg) => {
	// 		debug('Received service command: %o', g_msg);

	// 		if('openFlow' === g_msg.type) {
	// 			const dm_popover = dd('starshell-popover', {
	// 				params: stringify_params({
	// 					comm: 'query',
	// 					test: 'yes',
	// 				}),
	// 				style: `
	// 					display: block;
	// 					position: fixed;
	// 					left: 0;
	// 					bottom: 0;
	// 					width: 100vw;
	// 					height: 100vh;
	// 					transform: translateY(60%);
	// 				`,
	// 			});

	// 			document.body.append(dm_popover);
	// 		}
	// 	});
	// }


	async function add_input_overlay(dm_input: HTMLInputElement) {
		const {
			height: xl_height_input,
			width: xl_width_input,
		} = dm_input.getBoundingClientRect();

		const xl_width_overlay = Math.min(XL_WIDTH_OVERLAY_MAX, Math.max(XL_WIDTH_OVERLAY_MIN, Math.round(xl_width_input * XS_IDEAL_OVERLAY)));

		const g_computed = getComputedStyle(dm_input);
		const a_border = g_computed.borderRadius.split(/\s+/);
		const s_border_tr = a_border[1] || a_border[0];
		const s_border_br = a_border[3] || a_border[0];

		const Accounts = create_store_class({
			store: SI_STORE_ACCOUNTS,
			extension: 'map',
			class: class AccountsI extends WritableStoreMap<typeof SI_STORE_ACCOUNTS> {},
		});

		const a_accounts = (await Accounts.read()).entries().map(([, g]) => g);
		let i_account = 0;

		const b_multiaccount = a_accounts.length > 1;

		let sx_position = ['absolute', 'fixed', 'static'].includes(g_computed.position)
			? `margin-top: -${xl_height_input - 1}px;`
			: '';

		// attempt to compute relative offset wrt positioned ancestor
		{
			let dm_node: HTMLElement | null = dm_input;
			while(dm_node && !['absolute', 'relative'].includes(getComputedStyle(dm_node).position)) {
				dm_node = dm_node.parentElement;
			}

			if(dm_node) {
				const g_bounds_ancestor = dm_node.getBoundingClientRect();
				const g_bounds_input = dm_input.getBoundingClientRect();

				sx_position = `
					top: calc(${(g_bounds_input.top - g_bounds_ancestor.top)}px + ${g_computed.borderTopWidth});
					right: calc(${g_bounds_ancestor.right - g_bounds_input.right}px + ${g_computed.borderRightWidth});
				`;
			}
		}

		const dm_overlay = dd('div', {
			style: `
				position: absolute;
				background-color: rgba(0,0,0,0.6);
				height: ${xl_height_input - 2}px;
				margin-left: calc(${xl_width_input}px - ${xl_width_overlay}px);
				width: ${xl_width_overlay}px;
				filter: revert;
				font-size: 12px;
				font-family: 'Poppins',sans-serif;
				display: flex;
				align-items: center;
				justify-content: center;
				color: #f7f7f7;

				${sx_position}

				border-radius: 2em ${s_border_tr} ${s_border_br} 2em;
			`,
		}, [
			dd('span', {
				style: `
					width: 16px;
					height: 16px;
					background-image: url('${chrome.runtime.getURL('/media/vendor/icon_16.png')}');
					margin-right: 8px;
				`,
			}),
			dd('span', {
				style: `
					cursor: pointer;
					white-space: nowrap;
					overflow-x: hidden;
					text-overflow: ellipsis;
					max-width: calc(100% - 38px);

					border-radius: 1em;
					text-align: center;
					border-width: 1px;
					border-style: solid;
					border-color: #ffb61a;

					display: flex;
					${b_multiaccount
						? `
							min-width: 70%;
							justify-content: space-between;
						`
						: `
							min-width: 60%;
							padding: 3px 8px;
							justify-content: center;
						`}
				`,
			}, b_multiaccount
				? [
					dd('span', {
						style: `
							padding: 3px 3px 3px 8px;
							flex: auto;
						`,
					}, [`${a_accounts[i_account].name}`]),

					dd('span', {
						style: `
							border-left: 1px solid #ffb61a;
							padding: 0px 11px 0px 0px;
							flex-basis: 23px;
							writing-mode: vertical-rl;
							font-size: 12px;
							line-height: 1px;
							color: rgba(255,255,255,0.8);
						`,
					}, [
						dd('span', {
							style: `
								margin-right: 10px;
								line-height: 1px;
							`,
						}, ['>']),
					]),
				]
				: [
					dd('span', {}, [`${a_accounts[i_account].name}`]),
				]
			),
		]);

		dm_overlay.addEventListener('click', () => {
			const sa_owner = pubkey_to_bech32(a_accounts[i_account].pubkey, 'secret');
			dm_input.value = sa_owner;
			dm_overlay.remove();
			setTimeout(() => {
				dm_input.dispatchEvent(new InputEvent('input', {inputType:'insertText', data:'s'}));
				console.log('dispatched onto input;');
			}, 200);
		});

		dm_input.insertAdjacentElement('afterend', dm_overlay);
	}

	// wait for head to load
	async function dom_ready() {
		debug('dom_ready triggered');

		// load the app's pfp
		void load_app_pfp();

		// logged in
		if(await Vault.isUnlocked()) {
			// check if app is registered
			const g_app = await Apps.get(location.host, location.protocol as 'https:');
			if(g_app?.on) {
				debug('App is registered and enabled');

				try {
					// find autocompletable inputs
					qsa(document.body, 'input[type="text"]').forEach((dm_input) => {
						if(/^faucet-address$/.test(dm_input.id) || ('LABEL' === dm_input.previousElementSibling?.tagName && /wallet addr/i.test(dm_input.previousElementSibling.textContent!))) {
							const {
								height: xl_height_input,
								width: xl_width_input,
							} = dm_input.getBoundingClientRect();

							// input is visible; add input overlay
							if(xl_width_input * xl_height_input > 10) {
								void add_input_overlay(dm_input);
							}
							// input not visible, wait for it to appear
							else {
								// do not add overlay more than once
								let b_overlay_added = false;

								// observer callback
								const f_observer: MutationCallback = (di_mutations, d_observer) => {
									// check input bounds in a beat
									setTimeout(() => {
										const {
											height: xl_height_input_now,
											width: xl_width_input_now,
										} = dm_input.getBoundingClientRect();

										// is visible enough now
										if(xl_width_input_now * xl_height_input_now > 100) {
											// do not add more than once
											if(b_overlay_added) return;
											b_overlay_added = true;

											// remove observer
											d_observer.disconnect();

											// add overlay in a beat
											void add_input_overlay(dm_input);
										}
									}, 150);
								};

								// attach new observer to document body
								const d_observer = new MutationObserver(f_observer);
								d_observer.observe(document.body, {
									subtree: true,
									childList: true,
									attributes: true,
								});
							}
						}
					});
				}
				catch(e_app) {
					console.error(`Recovered from error: ${e_app.stack}`);
				}
			}
			else if(g_app) {
				console.warn(`App is disabled`);
			}
			else {
				console.debug(`App is not registered`);
			}
		}
	}

	if('loading' !== document.readyState) {
		debug(`document already in ${document.readyState} ready`);
		void dom_ready();
	}
	else {
		debug(`listening for DOMContentLoaded event on window`);
		window.addEventListener('DOMContentLoaded', dom_ready);
	}
})();
