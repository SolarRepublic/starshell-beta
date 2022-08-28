import { CosmosNetwork } from '#/chain/main';
import type { Account, AccountPath } from '#/meta/account';
import type { PlainObject } from '#/meta/belt';
import { Bech32, Chain, ChainPath, FamilyKey } from '#/meta/chain';
import { Network, NetworkPath } from '#/meta/network';
import type { Resource } from '#/meta/resource';
import type { Store, StoreKey } from '#/meta/store';
import type { ParametricSvelteConstructor } from '#/meta/svelte';
import type { Token } from '#/meta/token';
import { global_receive } from '#/script/msg-global';
import { B_MOBILE, B_SAFARI_MOBILE, N_PX_HEIGHT_POPUP, N_PX_WIDTH_POPUP, SI_STORE_MEDIA, SI_STORE_TAGS } from '#/share/constants';
import { Accounts } from '#/store/accounts';
import { Chains } from '#/store/chains';
import { Medias } from '#/store/medias';
import { ActiveNetwork, Networks } from '#/store/networks';
import { Tags } from '#/store/tags';
import type { H_STORE_REGISTRY, StoreRegistry } from '#/store/_registry';
import { Dict, F_NOOP, microtask, Promisable, timeout } from '#/util/belt';
import type { SvelteComponent, SvelteComponentTyped } from 'svelte';
import {
	derived,
	Subscriber,
	Unsubscriber,
	Updater,
	writable,
	type Readable,
	type Writable,
} from 'svelte/store';
import { ThreadId } from './def';
import type { Navigator } from './nav/navigator';
import type { Page } from './nav/page';
import type { Thread } from './nav/thread';
import { once_store_updates } from './svelte';
import PopupReceive from './ui/PopupReceive.svelte';


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
export const yw_chain = derivedSync<Chain['interface']>(yw_chain_ref, (p_chain, fk_set) => {
	void Chains.read().then(ks => fk_set(ks.at(p_chain as ChainPath)!))
		.catch((e_auth) => {
			fk_set(null);
		});

	// propagate change of chain to default network provider
	void Networks.read().then(ks => ks.entries().some(([p_network, g_network]) => {
		if(p_chain === g_network.chain) {
			yw_network_ref.set(p_network);
			return true;
		}

		return false;
	})).catch((e_auth) => {
		yw_network_ref.set('');
	});
});


/**
 * Selects the active network
 */
export const yw_network_ref = writableSync<NetworkPath>('' as NetworkPath);
export const yw_network = writableSync<Network['interface']>(null! as Network['interface']);
export const yw_network_active = derivedSync<ActiveNetwork>(yw_network_ref, (p_network, fk_set) => {
	if(!p_network) {
		yw_network.set(null as unknown as Network['interface']);
		fk_set(null as unknown as ActiveNetwork);
	}
	else {
		(async() => {
			const ks_networks = await Networks.read();
			const g_network = ks_networks.at(p_network as NetworkPath)!;
			yw_network.set(g_network);

			// chain differs; update
			if(g_network.chain !== yw_chain_ref.get()) {
				yw_chain_ref.set(g_network.chain);
			}

			const ks_chains = await Chains.read();
			const g_chain = ks_chains.at(g_network.chain)!;

			fk_set(Networks.activate(g_network, g_chain));
		})();
	}
});

// export const yw_chain = writableSync<Chain['interface']>(null! as Chain['interface']);
// yw_chain_ref.subscribe(async(p_chain) => {
// 	const ks_chains = await Chains.read();
// 	yw_chain.set(ks_chains.at(p_chain)!);
// })

/**
 * Derive family from chain
 */
export const yw_family = writableSync<FamilyKey>('' as FamilyKey);
yw_chain.subscribe(g_chain => yw_family.set(g_chain?.family || ''));


/**
 * Selects the active account
 */
export const yw_account_ref = writableSync<AccountPath>('' as AccountPath);
export const yw_account = derivedSync<Account['interface']>(yw_account_ref, (p_account, fk_set) => {
	void Accounts.read().then(ks => fk_set(ks.at(p_account as AccountPath)!))
		.catch((e_auth) => {
			fk_set(null);
		});
});

export const yw_owner: Readable<Bech32.String> = derived([yw_account, yw_chain], ([g_account, g_chain], fk_set) => {
	fk_set(Chains.addressFor(g_account.pubkey, g_chain));
});

// export const yw_account = writableSync<Account['interface']|null>(null);

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
 * Store caches
 */

const store_cache = <
	si_store extends StoreKey,
>(si_store: si_store) => writableSync<InstanceType<StoreRegistry<si_store>> | null>(null);

// reload a given store
async function reload(si_store: StoreKey) {
	switch(si_store) {
		case SI_STORE_MEDIA: {
			const ks_medias = await Medias.read();

			yw_store_medias.update(() => ks_medias);
			break;
		}

		case SI_STORE_TAGS: {
			const ks_tags = await Tags.read();

			yw_store_tags.update(() => ks_tags);
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
	'updateStore'({key:si_store}) {
		void reload(si_store);
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

export const yw_send_asset = writableSync<Token['interface'] | null>(null);


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


// export const yw_popup_receive = writableSync<Account | null>(null);


export const yw_blur = writableSync(false);

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


// get URL params
export const H_PARAMS = Object.fromEntries(new URL(location.href).searchParams.entries());

// whether or not this window is part of a native popup or not
export const B_NATIVE_POPUP = !('tab' in H_PARAMS);

// fits the app to the full viewport dimensions
function fit_viewport() {
	const d_style_root = document.documentElement.style;
	const d_viewport = globalThis.visualViewport;
	d_style_root.setProperty('--app-window-width', d_viewport.width+'px');
	d_style_root.setProperty('--app-window-height', d_viewport.height+'px');
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
		// ref html element
		const dm_html = document.documentElement;

		// get root style
		const d_style_root = dm_html.style;

		// use all available width on mobile device
		if(B_MOBILE) {
			// state of whether it is extended or collapsed
			let xc_scrollable = SCROLLABLE.NONE;

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
				fit_viewport();

				// scroll position is below
				if(dm_html.scrollTop > 0) {
					// scroll to nearly the top
					dm_html.scrollTo({
						top: 1,
						behavior: 'smooth',
					});
				}

				// (re)set max-height of html
				if(B_SAFARI_MOBILE && B_NATIVE_POPUP) {
					d_style_root.maxHeight = 'var(--app-window-height)';
				}
			}

			// immediately resize app on mobile
			await resize_app();

			// safari mobile
			if(B_SAFARI_MOBILE) {
				const d_viewport = globalThis.visualViewport;

				// within native popup
				if(B_NATIVE_POPUP) {
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
				}
				// launch URL
				else if('launch' === H_PARAMS.tab) {
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

					// anytime safari resizes the visual viewport (e.g., keyboard overlay or toolbar visibility)
					d_viewport.addEventListener('resize', () => {
						// adjust window height variable
						d_style_root.setProperty('--app-window-height', d_viewport.height+'px');

						// scroll document to nearly top
						dm_html.scrollTo({top:1, behavior:'smooth'});
					});

					return;
				}

				// 
				if('launch' !== H_PARAMS.tab) {
					// viewport is resized (e.g., from virtual keyboard overlay)
					d_viewport.addEventListener('resize', () => {
						console.log('#resize %o', {
							viewportHeight: d_viewport.height,
							innerHeight: window.innerHeight,
							scrollHeight: document.documentElement.scrollHeight,
							scrollTop: document.documentElement.scrollTop,
						});

						// returning to actual height, resize immediately
						if(d_viewport.height === dm_html.scrollHeight) {
							void resize_app();
						}
						// viewport is shrinking, debounce rapid resize events
						else if(d_viewport.height < window.innerHeight) {
							void resize_app();
						}
						// within native popup
						else if(B_NATIVE_POPUP) {
							void resize_app();
						}
					});
				}
			}
		}
		// desktop
		else {
			// window
			if('window' === H_PARAMS.tab) {
				d_style_root.setProperty('--app-window-width', '100%');
				d_style_root.setProperty('--app-window-height', '100%');
			}
		}

		let c_resizes = 0;

		let x_prev_width = N_PX_WIDTH_POPUP;
		let x_prev_height = N_PX_HEIGHT_POPUP;

		function resize(i_resize: number) {
			// ignore late delayed resizes
			if(c_resizes !== i_resize) return;

			const x_window_width = window.innerWidth;
			const x_window_height = window.innerHeight;

			let x_app_width = 0;
			let x_app_height = 0;

			console.log(`Window resize event: [${x_window_width}, ${x_window_height}]`);

			// on mobile
			if(B_MOBILE) {
				// temporarily assign full width/height
				maximize_viewport();

				// get full viewport dimensions
				const {
					width: sx_viewport_width,
					height: sx_viewport_height,
				} = globalThis.getComputedStyle(dm_html);

				console.log(`Full viewport dimensions: [${sx_viewport_width}, ${sx_viewport_height}]`);

				// width or height is being constrained by viewport
				if(x_window_width < +sx_viewport_width.replace(/px$/, '')) {
					x_app_width = x_window_width;
					console.log(`width ${x_window_width} < ${+sx_viewport_width.replace(/px$/, '')}`);
				}

				if(x_window_height < +sx_viewport_height.replace(/px$/, '')) {
					x_app_height = x_window_height;
					console.log(`height ${x_window_height} < ${+sx_viewport_height.replace(/px$/, '')}`);
				}
			}
			else {
				x_app_width = x_window_width;
				x_app_height = x_window_height;
			}

			console.log({
				x_prev_width,
				x_prev_height,
				x_app_width,
				x_app_height,
			});

			if(x_app_width && x_app_width !== x_prev_width) {
				d_style_root.setProperty('--app-window-width', `${x_app_width}px`);
				x_prev_width = x_window_width;
			}

			if(x_app_height && x_app_height !== x_prev_height) {
				d_style_root.setProperty('--app-window-height', `${x_app_height}px`);
				x_prev_height = x_window_height;
			}
		}

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
