import type {AccountInterface, AccountPath} from '#/meta/account';
import type {Bech32, ChainPath, ChainNamespaceKey, ChainInterface, ContractInterface} from '#/meta/chain';
import type {Provider, ProviderInterface, ProviderPath} from '#/meta/provider';
import type {StoreKey} from '#/meta/store';
import type {ParametricSvelteConstructor} from '#/meta/svelte';
import {global_receive} from '#/script/msg-global';
import {B_FIREFOX_ANDROID, B_MOBILE, B_NATIVE_IOS, B_SAFARI_MOBILE, B_WITHIN_PWA, B_WITHIN_WEBEXT_POPOVER, H_PARAMS, N_PX_FIREFOX_TOOLBAR, SI_STORE_MEDIA, SI_STORE_TAGS} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Chains} from '#/store/chains';
import {Medias} from '#/store/medias';
import {
	type ActiveNetwork,
	Providers,
} from '#/store/providers';
import {Tags} from '#/store/tags';
import type {StoreRegistry} from '#/store/_registry';
import {F_NOOP, microtask, timeout} from '#/util/belt';
import type {Dict} from '#/meta/belt';
import {
	derived,
	writable,
	type Readable,
	type Writable,
} from 'svelte/store';
import type {ThreadId} from './def';
import type {Navigator} from './nav/navigator';
import type {Page} from './nav/page';
import type {Thread} from './nav/thread';
import {once_store_updates} from './svelte';
import PopupReceive from './ui/PopupReceive.svelte';
import type { Vocab } from '#/meta/vocab';
import type { Pwa } from '#/script/messages';
import type { CosmosNetwork } from '#/chain/cosmos-network';


/**
 * Extended version of svelte's Writable that allows for synchronous `get()` calls.
 */
export interface WritableSync<
	w_value extends any=any,
> extends Writable<w_value> {
	get(): w_value;
}

/**
 * Creates an object that extends svelte Writable stores by allowing synchronous `get()`.
 */
export function writableSync<
	w_value extends any,
>(w_value: w_value): WritableSync<w_value> {
	// create writable store
	const yw_original = writable<w_value>(w_value);

	// create a new object that inherits from the original store as a prototype
	return Object.assign(Object.create(yw_original), {
		// intercept call in order to update cache
		set(w_set: w_value) {
			w_value = w_set;
			return yw_original.set(w_set);
		},

		// get the stored value
		get(): w_value {
			return w_value;
		},
	}) as WritableSync<w_value>;
}

/**
 * Extended version of svelte's Readable that allows for synchronous `get()` calls.
 */
export interface ReadableSync<
	w_value extends any=any,
> extends Readable<w_value> {
	get(): w_value;
}

// type DerivedCallback<
// 	w_value extends any,
// 	z_src extends WritableSync<w_value> | WritableSync<w_value>[],
// > = z_src extends WritableSync<w_value>[]
// 	? {
// 		(w_value: w_value): w_value;
// 	}
// 	: {
// 		(a_values: w_value[]): w_value;
// 	};

type Arrayable<w_type> = w_type | Array<w_type>;

/**
 * Creates an object that extends svelte Derived stores by allowing synchronous `get()`.
 */
// export function derivedSync<
// 	w_out extends any,
// 	w_value extends any,
// 	a_srcs extends WritableSync<w_value>[]=WritableSync<w_value>[],
// >(a_srcs: a_srcs, f_transform: (...a_inputs: w_value[]) => w_out): ReadableSync<w_out>;
// export function derivedSync<
// 	w_out extends any,
// 	w_value extends any,
// 	yw_src extends WritableSync<w_value>=WritableSync<w_value>,
// >(yw_src: yw_src, f_transform: (yw_src: yw_src) => w_out): ReadableSync<w_out>;
export function derivedSync<
	w_out extends any,
	w_value extends any=any,
	z_src extends Arrayable<ReadableSync<w_value>>=Arrayable<ReadableSync<w_value>>,
>(
	z_src: z_src,
	f_transform: z_src extends ReadableSync[]
		? (a_inputs: w_value[]) => w_out
		: z_src extends ReadableSync<infer w_actual>
			? (w_input: w_actual, f_set: (w_set: w_out) => void) => w_out
			: never
): ReadableSync<w_out> {
	// writable source argument is an array
	if(Array.isArray(z_src)) {
		return Object.assign(Object.create(derived<z_src, w_out>(z_src, f_transform as (w_input: any) => w_out)), {
			get(): w_out {
				return f_transform(...z_src);
			},
		}) as ReadableSync<w_out>;
	}
	// single store
	else {
		// prep cache
		let w_cache: w_out;

		// create derived store
		const yw_original = derived<z_src, w_out>(z_src, (w_input, fk_set) => {
			f_transform(w_input, (w_output) => {
				w_cache = w_output;
				fk_set(w_output);
			});
		});

		// create a new object that inherits from the original store as a prototype
		return Object.assign(Object.create(yw_original), {
			// get the stored value
			get(): w_out {
				return w_cache;
			},
		}) as ReadableSync<w_out>;
	}
}

/**
 * The navigator object for this window
 */
export const yw_navigator = writableSync<Navigator>(null! as Navigator);


/**
 * Selects the active chain
 */
export const yw_chain_ref = writableSync<ChainPath>('' as ChainPath);
export const yw_chain = derivedSync<ChainInterface>(yw_chain_ref, (p_chain, fk_set) => {
	void Chains.read().then(ks => fk_set(ks.at(p_chain as ChainPath)!))
		.catch((e_auth) => {
			fk_set(null);
		});

	// propagate change of chain to default provider
	void Providers.read().then(ks => ks.entries().some(([p_provider, g_provider]) => {
		if(p_chain === g_provider.chain) {
			yw_provider_ref.set(p_provider);
			return true;
		}

		return false;
	})).catch((e_auth) => {
		yw_provider_ref.set('');
	});
});


/**
 * Selects the active provider
 */
export const yw_provider_ref = writableSync<ProviderPath>('' as ProviderPath);
export const yw_provider = writableSync<ProviderInterface>(null! as ProviderInterface);
export const yw_network = derivedSync<CosmosNetwork>(yw_provider_ref, (p_provider, fk_set) => {
	if(!p_provider) {
		yw_provider.set(null as unknown as ProviderInterface);
		fk_set(null as unknown as CosmosNetwork);
	}
	else {
		(async() => {
			const ks_providers = await Providers.read();
			const g_provider = ks_providers.at(p_provider as ProviderPath)!;
			yw_provider.set(g_provider);

			// chain differs; update
			if(g_provider.chain !== yw_chain_ref.get()) {
				yw_chain_ref.set(g_provider.chain);
			}

			const ks_chains = await Chains.read();
			const g_chain = ks_chains.at(g_provider.chain)!;

			fk_set(Providers.activate(g_provider, g_chain));
		})();
	}
});

// export const yw_chain = writableSync<ChainInterface>(null! as ChainInterface);
// yw_chain_ref.subscribe(async(p_chain) => {
// 	const ks_chains = await Chains.read();
// 	yw_chain.set(ks_chains.at(p_chain)!);
// })

/**
 * Derive namespace from chain
 */
export const yw_chain_namespace = writableSync<ChainNamespaceKey>('' as ChainNamespaceKey);
yw_chain.subscribe(g_chain => yw_chain_namespace.set(g_chain?.namespace || ''));


/**
 * Selects the active account
 */
export const yw_account_ref = writableSync<AccountPath>('' as AccountPath);
export const yw_account = derivedSync<AccountInterface>(yw_account_ref, (p_account, fk_set) => {
	void Accounts.read().then(ks => fk_set(ks.at(p_account as AccountPath)!))
		.catch((e_auth) => {
			fk_set(null);
		});
});
export const yw_account_editted = writableSync(0);

export const yw_owner: Readable<Bech32> = derived([yw_account, yw_chain], ([g_account, g_chain], fk_set) => {
	fk_set(Chains.addressFor(g_account.pubkey, g_chain));
});



/**
 * Shows/hides the vendor menu
 */
export const yw_menu_vendor = writableSync(false);

/**
 * Shows/hides the account selector overlay
 */
export const yw_overlay_account = writableSync(false);

/**
 * Shows/hides the network selector overlay
 */
export const yw_overlay_network = writableSync(false);

/**
 * Shows/hides the app selector overlay
 */
export const yw_overlay_app = writableSync(false);

/**
 * Store caches
 */

const store_cache = <
	si_store extends StoreKey,
>(si_store: si_store) => writableSync<InstanceType<StoreRegistry<si_store>> | null>(null);

// reload a given store
async function reload(si_store: StoreKey): Promise<void> {
	switch(si_store) {
		case SI_STORE_MEDIA: {
			const ks_medias = await Medias.read();

			yw_store_medias.update(() => ks_medias);
			break;
		}

		case SI_STORE_TAGS: {
			const ks_tags = await Tags.read();

			yw_store_tags.update(() => ks_tags);
			break;
		}

		default: {
			// ignore
		}
	}
}


export const yw_store_medias = store_cache(SI_STORE_MEDIA);
export const yw_store_tags = store_cache(SI_STORE_TAGS);


// register for updates
global_receive({
	async 'updateStore'({key:si_store}) {
		await reload(si_store);
	},
});

export async function initialize_caches(): Promise<void> {
	await Promise.all([
		reload(SI_STORE_MEDIA),
		reload(SI_STORE_TAGS),
	]);
}


export const yw_page = writableSync<Page>(null! as Page);

// export const yw_thread_id = writableSync(ThreadId.DEFAULT);

export const yw_thread = writableSync<Thread>(null! as Thread);

export const yw_path = writableSync('');

export const yw_uri = derivedSync(yw_path, $yw => `s2r://root/${$yw}`);

export const yw_pattern = writableSync('');


export const yw_notifications = writableSync<Array<string | ThreadId>>([]);

export const yw_nav_collapsed = writable(false);

export const yw_nav_visible = writableSync(false);

export const yw_progress = writableSync([0, 0] as [number, number]);

// export const yw_path_parts = derivedSync(yw_path, $yw => ($yw as string).split('/'));



export const yw_search = writable('');

export const yw_cancel_search = writableSync<VoidFunction>(F_NOOP);

// export const yw_fuse = writable<Fuse<SearchItem>>();

export const yw_send_asset = writableSync<ContractInterface | null>(null);


// export const yw_params = writableSync({
// 	familyId: yw_family.get()?.def.id || '.default',
// 	chainId: yw_chain.get()?.def.id || '*',
// 	accountId: yw_account.get().def.id,
// });

export const yw_task = writableSync(0);

export const yw_help = writableSync<HTMLElement[]>([]);

export const yw_header_props = writableSync<Dict>({});

export const yw_exitting_dom = writableSync<HTMLElement>(null!);

export const yw_menu_expanded = writableSync(false);


export const yw_overscroll_pct = writableSync(0);

/**
 * Provide arbitrary context to the popup
 */
export const yw_context_popup = writableSync<Dict<any> | null>(null);

/**
 * Sets the component to use as the popup and shows it
 */
export const yw_popup = writableSync<ParametricSvelteConstructor | null>(null);


export function popup_receive(p_account: AccountPath): void {
	yw_context_popup.set({
		account: p_account,
	});
	yw_popup.set(PopupReceive);
}


/**
 * Toggles the curtain flag for screens that use the Curtain component
 */
export const yw_curtain = writableSync<boolean>(false);


// export const yw_popup_receive = writableSync<Account | null>(null);


export const yw_blur = writableSync(false);

export const yw_doc_visibility = writableSync('unset');
if('object' === typeof document) {
	document.addEventListener('visibilitychange', () => {
		yw_doc_visibility.set(document.visibilityState);
	});
}

// export const yw_holding_send = derived([yw_asset_send, yw_account, yw_chain], ([$yw_asset, $yw_acc, $yw_ch]) => {
// 	if($yw_asset && $yw_acc) {
// 		const p_token = $yw_asset.def.iri;
// 		const sa_holder = $yw_acc.address($yw_ch);
// 		const p_holding = Holding.refFromTokenAccount(p_token, sa_holder);
// 		return H_HOLDINGS[p_holding];
// 	}

// 	return null;
// });


export const hm_arrivals: WeakMap<HTMLElement, VoidFunction> = new Map();
export function arrival(dm_screen: HTMLElement, fk_arrive: VoidFunction) {
	hm_arrivals.set(dm_screen, fk_arrive);
}


// ref viewport object
const d_viewport = globalThis.visualViewport || {
	width: globalThis.window?.innerWidth || 0,
	height: globalThis.window?.innerHeight || 0,
} as VisualViewport;

// fits the app to the full viewport dimensions
function fit_viewport(xl_offset_height=0) {
	const d_style_root = document.documentElement.style;
	if(d_viewport) {
		const xl_width = d_viewport.width;
		const xl_height = d_viewport.height + xl_offset_height;

		if(xl_width * xl_height > 100) {
			d_style_root.setProperty('--app-window-width', Math.floor(xl_width)+'px');
			d_style_root.setProperty('--app-window-height', Math.floor(xl_height)+'px');
		}
	}
}

// watches the viewport height for changes and updates the view accordingly
function continually_adjust_height(xl_offset=0, fk_resized?: VoidFunction) {
	// anytime browser resizes the visual viewport (e.g., keyboard overlay or toolbar visibility)
	d_viewport.addEventListener?.('resize', () => {
		// adjust window height variable
		document.documentElement.style.setProperty('--app-window-height', Math.floor(d_viewport.height+xl_offset)+'px');

		// callback
		fk_resized?.();
	});
}

// states of scrollable area
enum SCROLLABLE {
	NONE=0,
	EXTENDED=1,
	COLLAPSED=2,
}

// wait for window to load
if('undefined' !== typeof document) {
	void once_store_updates(yw_navigator).then(async() => {
		console.debug(`System navigator ready`);

		// ref html element
		const dm_html = document.documentElement;

		// get root style
		const d_style_root = dm_html.style;

		// use all available width on mobile device
		if(B_MOBILE) {
			// state of whether it is extended or collapsed
			let xc_scrollable = SCROLLABLE.NONE;

			// height offset due to browser chrome
			let xl_offset_height = 0;

			// extend the height of the document so that the use can scroll down to hide the safari toolbar
			function extend_scrollable() {
				// +200px seems to be the lowest safe amount to overflow the page in order for safari to hide the toolbar
				dm_html.style.height = 'calc(200px + 100vh)';

				xc_scrollable = SCROLLABLE.EXTENDED;
			}

			// remove the extra scrollable space at the bottom so there is no akward space
			function collapse_scrollabe() {
				// set to +1px so that scrollable height does not fit within viewport, otherwise safari will show toolbar
				dm_html.style.height = 'calc(1px + 100vh)';

				xc_scrollable = SCROLLABLE.COLLAPSED;
			}

			// resize the entire app according to viewport
			async function resize_app() {
				// delete max height temporarily
				dm_html.style.maxHeight = '';

				// start by setting dimensions to fill entire viewport
				dm_html.style.width = '100vw';
				dm_html.style.height = '100vh';

				// wait a tick
				await microtask();

				// update viewport
				fit_viewport(xl_offset_height);

				// scroll position is below
				if(dm_html.scrollTop > 0) {
					// scroll to nearly the top
					dm_html.scrollTo({
						top: 1,
						behavior: 'smooth',
					});
				}

				// (re)set max-height of html
				if(B_SAFARI_MOBILE && B_WITHIN_WEBEXT_POPOVER) {
					d_style_root.maxHeight = 'var(--app-window-height)';
				}
			}

			// safari mobile
			if(B_SAFARI_MOBILE) {
				// within webext popup
				if(B_WITHIN_WEBEXT_POPOVER) {
					// set padding bottom in order to clear home bar
					d_style_root.setProperty('--app-window-padding-bottom', '15px');
					d_style_root.background = 'var(--theme-color-bg)';

					// system dark theme
					if(globalThis.matchMedia('(prefers-color-scheme: dark)')) {
						document.body.style.background = 'rgb(68, 27, 0)';
					}
					// system light theme
					else {
						document.body.style.background = 'rgb(255, 159, 0)';
					}

					// show terminus
					document.getElementById('terminus')!.style.display = 'block';

					// dynamic app height
					continually_adjust_height(0, () => {
						// scroll document to nearly top
						dm_html.scrollTo({top:1, behavior:'smooth'});
					});
				}
				// within tab
				else if('tab' === H_PARAMS.within) {
					// on ios, require user to scroll down to hide UI
					extend_scrollable();

					// set body height
					document.body.style.height = '100vh';
					document.body.style.maxHeight = 'var(--app-window-height)';

					// // scroll down to hide toolbar
					// function trim_once() {
					// 	// reached bottom
					// 	if(window.innerHeight + dm_html.scrollTop >= dm_html.scrollHeight) {
					// 		// scroll document to top
					// 		dm_html.scrollTo({top:1, behavior:'smooth'});

					// 		// remove self
					// 		document.removeEventListener('scroll', trim_once);
					// 	}
					// }

					// listen for scroll events
					document.addEventListener('scroll', async() => {
						// scrollable area is extended
						if(SCROLLABLE.EXTENDED === xc_scrollable) {
							// user scrolled past bottom
							if(dm_html.scrollTop >= 10) {
								console.log('scrolled beyond bottom while extended');

								// collapse scrollable (view will automatically smooth scroll to top)
								collapse_scrollabe();

								// pause
								await timeout(2e3);

								console.log('extended scrollable again');

								// make collapsible again
								extend_scrollable();
							}
						}
					});

					// dynamic app height
					continually_adjust_height(0, () => {
						// scroll document to nearly top
						dm_html.scrollTo({top:1, behavior:'smooth'});
					});
				}

				// // 
				// if(B_WITHIN_WEBEXT_POPOVER) {
				// 	// viewport is resized (e.g., from virtual keyboard overlay)
				// 	d_viewport.addEventListener('resize', () => {
				// 		console.log('#resize %o', {
				// 			viewportHeight: d_viewport.height,
				// 			innerHeight: window.innerHeight,
				// 			scrollHeight: document.documentElement.scrollHeight,
				// 			scrollTop: document.documentElement.scrollTop,
				// 		});

				// 		// returning to actual height, resize immediately
				// 		if(d_viewport.height === dm_html.scrollHeight) {
				// 			void resize_app();
				// 		}
				// 		// viewport is shrinking, debounce rapid resize events
				// 		else if(d_viewport.height < window.innerHeight) {
				// 			void resize_app();
				// 		}
				// 		// within native popup
				// 		else if(B_WITHIN_WEBEXT_POPOVER) {
				// 			void resize_app();
				// 		}
				// 	});
				// }
			}
			// firefox for android
			else if(B_FIREFOX_ANDROID) {
				// // set padding bottom in order to clear home bar
				// d_style_root.setProperty('--app-window-padding-bottom', '15px');

				// in PWA mode
				if(B_WITHIN_PWA) {
					// listen for resize messages from top frame
					(window as Vocab.TypedWindow<Pwa.TopToIframe>).addEventListener('message', (d_event) => {
						const {
							type: si_type,
							value: g_value,
						} = d_event.data;

						if('visualViewportResize' === si_type) {
							// adjust window height variable
							document.documentElement.style.setProperty('--app-window-height', Math.floor(g_value.height)+'px');
						}
					});

					// request size
					(window.top as Vocab.TypedWindow<Pwa.IframeToTop>).postMessage({
						type: 'fetchVisualViewportSize',
					}, 'https://launch.starshell.net');
				}
				// in firefox
				else {
					// // adjust window height
					// let xl_height = Math.floor(d_viewport.height);

					// in browser tab
					if(!B_WITHIN_WEBEXT_POPOVER) {
						// adjust window height by offset
						xl_offset_height = -N_PX_FIREFOX_TOOLBAR;
					}

					// // make sure height is reasonable
					// if(xl_height > 100) {
					// 	console.log(`Adjusting new height to ${Math.floor(xl_height)}`);
					// 	d_style_root.setProperty('--app-window-height', `${Math.floor(xl_height)}px`);
					// }

					// // fit viewport
					// fit_viewport(xl_offset_height);

					// dynamic app height. firefox toolbar takes up about 56 pixels
					continually_adjust_height(xl_offset_height);
				}

				// set body height
				document.body.style.height = '100vh';
				document.body.style.maxHeight = 'var(--app-window-height)';
			}
			// within native ios webkit view
			else if(B_NATIVE_IOS) {
				fit_viewport();

				// set body height
				document.body.style.height = '100vh';
				document.body.style.maxHeight = 'var(--app-window-height)';

				// set padding bottom in order to clear home bar
				d_style_root.setProperty('--app-window-padding-bottom', '20px');

				// dynamic app height
				continually_adjust_height(0, () => {
					// scroll document to nearly top
					dm_html.scrollTo({top:0, behavior:'smooth'});
				});
			}

			// resize app on mobile
			await resize_app();
		}
		// desktop
		else {
			fit_viewport();

			// window
			if(['popout', 'tab'].includes(H_PARAMS.within as string)) {
				fit_viewport();

				// take up fill window
				d_style_root.width = d_style_root.height = '100%';

				continually_adjust_height();
			}
		}

		// const c_resizes = 0;

		// let x_prev_width = N_PX_WIDTH_POPUP;
		// let x_prev_height = N_PX_HEIGHT_POPUP;

		// function resize(i_resize: number) {
		// 	// ignore late delayed resizes
		// 	if(c_resizes !== i_resize) return;

		// 	const x_window_width = window.innerWidth;
		// 	const x_window_height = window.innerHeight;

		// 	let x_app_width = 0;
		// 	let x_app_height = 0;

		// 	console.log(`Window resize event: [${x_window_width}, ${x_window_height}]`);

		// 	// on mobile
		// 	if(B_MOBILE) {
		// 		// temporarily assign full width/height
		// 		maximize_viewport();

		// 		// get full viewport dimensions
		// 		const {
		// 			width: sx_viewport_width,
		// 			height: sx_viewport_height,
		// 		} = globalThis.getComputedStyle(dm_html);

		// 		console.log(`Full viewport dimensions: [${sx_viewport_width}, ${sx_viewport_height}]`);

		// 		// width or height is being constrained by viewport
		// 		if(x_window_width < +sx_viewport_width.replace(/px$/, '')) {
		// 			x_app_width = x_window_width;
		// 			console.log(`width ${x_window_width} < ${+sx_viewport_width.replace(/px$/, '')}`);
		// 		}

		// 		if(x_window_height < +sx_viewport_height.replace(/px$/, '')) {
		// 			x_app_height = x_window_height;
		// 			console.log(`height ${x_window_height} < ${+sx_viewport_height.replace(/px$/, '')}`);
		// 		}
		// 	}
		// 	else {
		// 		x_app_width = x_window_width;
		// 		x_app_height = x_window_height;
		// 	}

		// 	console.log({
		// 		x_prev_width,
		// 		x_prev_height,
		// 		x_app_width,
		// 		x_app_height,
		// 	});

		// 	if(x_app_width && x_app_width !== x_prev_width) {
		// 		d_style_root.setProperty('--app-window-width', `${x_app_width}px`);
		// 		x_prev_width = x_window_width;
		// 	}

		// 	if(x_app_height && x_app_height !== x_prev_height) {
		// 		d_style_root.setProperty('--app-window-height', `${x_app_height}px`);
		// 		x_prev_height = x_window_height;
		// 	}
		// }

		// // respond to window resize events in order to update root css variable
		// const d_style_root = dm_html.style;
		// window.addEventListener('resize', () => {
		// 	const i_resize = ++c_resizes;

		// 	console.log({
		// 		innerWidth: window.innerWidth,
		// 		innerHeight: window.innerHeight,
		// 		outerWidth: window.outerWidth,
		// 		outerHeight: window.outerHeight,
		// 	});

		// 	resize(i_resize);

		// 	setTimeout(() => resize(i_resize), 250);
		// 	setTimeout(() => resize(i_resize), 750);
		// 	setTimeout(() => resize(i_resize), 1000);
		// });

		// // // continuously adjust size since mobile devices don't always fire the event
		// // setInterval(() => {
		// // 	resize(++c_resizes);
		// // }, 2e3);

		// // initialize
		// window.dispatchEvent(new Event('resize'));

		// global key events
		window.addEventListener('keydown', (d_event) => {
			// escape key
			if('Escape' === d_event.key) {
				// popup is open; close it
				if(yw_popup.get()) {
					yw_popup.set(null);
				}
			}
		});
	});
}
