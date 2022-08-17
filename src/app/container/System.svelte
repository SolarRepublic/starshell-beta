<script lang="ts">
	import {
		getAllContexts,
		onMount,
		tick,
	} from 'svelte';

	import type { PlainObject } from '#/meta/belt';
	import {
		ode,
		oderom,
		timeout,
	} from '#/util/belt';

	import OverscrollSvelte from './system/Overscroll.svelte';
	import PopupSvelte from './system/Popup.svelte';
	import NavSvelte from './system/Nav.svelte';
	import SearchSvelte from './system/Search.svelte';
	import ProgressSvelte from './system/Progress.svelte';
	import SideMenuSvelte from './system/SideMenu.svelte';
	import VendorMenuSvelte from './system/VendorMenu.svelte';
	import NotificationsSvelte from './system/Notifications.svelte';

	import BlankSvelte from '##/screen/Blank.svelte';

	import type { Page, PageConfig } from '##/nav/page';
	import type { PopConfig, Thread } from '##/nav/thread';
	import { Navigator, NavigatorConfig } from '##/nav/navigator';

	import { H_THREADS } from '##/def';
	import { yw_account, yw_account_ref, yw_chain, yw_chain_ref, yw_navigator, yw_nav_visible, yw_network, yw_network_active, yw_network_ref, yw_page, yw_thread } from '##/mem';
	import { Chains } from '#/store/chains';
	import { Accounts } from '#/store/accounts';
	import { once_store_updates } from '../svelte';
	import { Networks } from '#/store/networks';
	import { Vault } from '#/crypto/vault';

	export let page: PageConfig;
	const gc_page = page;

	export let mode: 'app' | 'flow';
	const b_flow = 'flow' === mode;
	const b_main = 'app' === mode;

	let dm_viewport: HTMLElement;
	let dm_threads: HTMLElement;
	let dm_content: HTMLElement;
	let dm_exitting: HTMLElement;

	// get all contexts
	const h_context_all = Object.fromEntries(getAllContexts().entries());

	async function slide(dm_slide: HTMLElement, b_in=false): Promise<void> {
		// smoother, allow for previous mods to make element visible
		await timeout(0);

		// go async
		return new Promise((fk_resolve) => {
			// wait for transition to complete
			dm_slide.addEventListener('transitionend', function transition_end(d_event) {
				if('transform' === d_event.propertyName) {
					// change class
					dm_slide.classList.add('slid');

					fk_resolve();
				}
			});

			// apply transform
			dm_slide.style.transform = `translateX(${b_in? '0px': 'var(--app-window-width)'})`;
		});
	}

	onMount(async() => {
		// navigator config
		const gc_navigator: NavigatorConfig = {
			// threads container
			container: dm_threads,

			// forward all contexts
			context: h_context_all,

			// default threads config
			threads: {
				default: () => ({
					creator: BlankSvelte,
				}),
			},

			// default hooks
			hooks: {
				before_change(kt_context, kp_src, kp_dst) {
					// blur on page
					void kp_src.fire('blur');
				},

				// once a new page has been pushed
				after_push(kt_context, kp_src, kp_dst) {
					// // push state to navigator history
					// history.pushState(null, '', '#page:'+kp_dst.id);

					// wait for svelte to render component before querying container
					void tick().then(() => {
						// query container for last element child
						void slide(kp_dst.dom, true);
					});
				},

				// once a page has been popped
				after_pop(kt_context, kp_src, kp_dst, gc_pop) {
					// notify dst page
					void kp_dst.fire('restore');

					// do not bypass animation
					if(!gc_pop.bypassAnimation) {
						// apply translation transform to src page
						kp_src.dom.style.transform = `translateX(var(--app-window-width))`;
					}
				},

				// upon any page change
				after_change(kt_context, kp_src, kp_dst, s_transition, h_extra={}) {
					// set global page and thread
					$yw_page = kp_dst;
					$yw_thread = kt_context;

					// notify dst page
					void kp_dst.fire('focus');

					// // maintain scrollTop of the src page
					// const x_scroll_top = kp_src.dom.scrollTop;

					// debugger;
				},

				async before_switch() {
					// allow these to fail in order to recover from disasters
					try {
						// set defaults
						await Promise.all([
							// default chain
							$yw_chain || once_store_updates(yw_chain, true),
							Chains.read().then(ks => $yw_chain_ref = ode(ks.raw)[0][0]),

							// default network
							$yw_network_active || once_store_updates(yw_network_active, true),
							Networks.read().then(ks => $yw_network_ref = ode(ks.raw)[0][0]),

							// default account
							$yw_account || once_store_updates(yw_account, true),
							Accounts.read().then(ks => $yw_account_ref = ode(ks.raw)[0][0]),
						]);

						// only needs to happen once
						delete this.before_switch;
					}
					catch(e_load_default) {
						// console.log(e_load_default);
					}
				},

				async after_switch(kt_src, kt_dst) {
					// set global page and thread
					$yw_page = kt_dst.page;
					$yw_thread = kt_dst;

					// focus on page
					void kt_dst.page.fire('focus');

					// wait for svelte to render component before querying container
					await tick();

					// query container for last element child
					await slide(kt_dst.page.dom, true);
				},
			},
		};

		// specific page given
		if(b_flow) {
			// override threads config
			gc_navigator.threads = {
				default: () => gc_page,
			};
		}
		// main system
		else if(b_main) {
			// override threads config
			gc_navigator.threads = oderom(H_THREADS, (si_thread, dc_screen) => {
				// // lookup router node corresponding to screen class
				// const k_node = K_ROUTER.lookup_screen(dc_screen);

				// // ref path pattern
				// const sx_pattern = k_node.path_pattern;

				return {
					[si_thread]: (h_props: PlainObject) => ({
						creator: dc_screen,
						props: h_props,
						// path: k_node.reverse_resolve(h_props),
						// pattern: sx_pattern,
						// screen: dc_screen,
					}),
				} as Record<typeof si_thread, (h_props: PlainObject) => PageConfig>;
			});

			// set init
			gc_navigator.threads.init = (h_props: PlainObject, h_context?: PlainObject) => ({
				...gc_page,
				props: {
					...gc_page.props,
					...h_props,
				},
				context: {
					...gc_page.context,
					...h_context,
				},
			});
		}

		const k_navigator = new Navigator(gc_navigator);
		$yw_navigator = k_navigator;



		// handle pop state
		// window.onpopstate = function(d_event: PopStateEvent) {
		// 	k_navigator.activePage.pop({
		// 		external: true,
		// 	});
		// };

		// $yw_exitting_dom = dm_exitting;

		// const k_state_root = new State('/locked', null as unknown as SvelteComponent, '/locked');
		// const k_thread_root = new StateThread(k_state_root);

	// 	initialize(new StateManager({
	// 		router: K_ROUTER,

	// 		arrive(this: StateManager, ks_src: State, ks_dst: State, si_thread_src: string, s_transition=''): Promise<void> {
	// 			// maintain scrollTop
	// 			const x_scroll_top = ks_src.dom.scrollTop;

	// 			console.log({
	// 				type: 'arrive',
	// 				ks_src,
	// 				ks_dst,
	// 				si_thread_src,
	// 				s_transition,
	// 			});

	// 			// new MutationObserver((m) => {
	// 			// 	debugger;
	// 			// }).observe(ks_src.dom, {
	// 			// 	attributes: true,
	// 			// 	childList: true,
	// 			// });

	// 			// Object.defineProperty(ks_src.dom, 'scrollTop', {
	// 			// 	get() {
	// 			// 		return x_scroll_top;
	// 			// 	},
	// 			// 	set(x_to: number) {
	// 			// 		console.log(`SET TO: ${x_to}`);
	// 			// 		debugger;
	// 			// 	},
	// 			// });

	// 			// neuter src frame
	// 			ks_src.dom.classList.add('frozen');

	// 			// ensure incoming frame is not frozen
	// 			ks_dst.dom.classList.remove('frozen');

	// 			const gc_params = yw_params.get();
	// 			// const gc_params = {};

	// 			$yw_path = ks_dst.path;
	// 			$yw_pattern = ks_dst.pattern;

	// 			const gc_props = ks_dst.props;

	// 			$yw_params = {
	// 				familyId: gc_props.familyId as string || gc_params.familyId,
	// 				chainId: gc_props.chainId as string || gc_params.chainId,
	// 				accountId: gc_props.accountId as string || gc_params.accountId,
	// 			};

	// 			if(gc_props.familyId) {
	// 				const p_family = Family.refFromId(gc_props.familyId as string);
	// 				if(!H_FAMILIES[p_family]) debugger;
	// 				$yw_family = H_FAMILIES[p_family];
	// 			}

	// 			// if(gc_props.chainId) {
	// 			// 	if(!$yw_family) debugger;
	// 			// 	const p_chain = Chain.refFromFamilyId($yw_family.def.iri, gc_props.chainId as string);
	// 			// 	$yw_chain = H_CHAINS[p_chain] || null;
	// 			// }

	// 			// if(gc_props.accountId) {
	// 			// 	console.warn(`<${$yw_path}> props set accountId = ${gc_props.accountId}`);
	// 			// 	$yw_account = H_ACCOUNTS[Account.refFromId(gc_props.accountId as string)];
	// 			// }

	// 			$yw_screen_dom = ks_dst.dom;

	// 			// trigger component settings
	// 			const fk_arrive = hm_arrivals.get(ks_dst.dom);
	// 			if(fk_arrive) fk_arrive();

	// 			// eslint-disable-next-line
	// 			return new Promise(async(fk_resolve) => {
	// 				// ref src state's dom
	// 				let dm_src = ks_src.dom;

	// 				// ref classlist
	// 				const d_class_list = dm_src.classList;

	// 				// short circuit expensive computed style call
	// 				let b_transitions = false;
	// 				if('goto' === s_transition) {
	// 					if(d_class_list.contains('slides')) {
	// 						// changing threads
	// 						if(si_thread_src) {
	// 							dm_src = dm_src.cloneNode(true) as HTMLElement;
	// 							dm_exitting.replaceChildren(dm_src);
	// 						}

	// 						dm_src.style.zIndex = '1001';

	// 						await timeout(0);

	// 						// dm_src.style.left = `-${XP_APP_WIDTH}px`;
	// 						dm_src.style.transform = `translate(-${XP_APP_WIDTH}px)`;
	// 						b_transitions = true;
	// 					}
	// 					else {
	// 						const si_exit = dm_src.getAttribute('data-s2-exit') as string;

	// 						switch(si_exit) {
	// 							case 'swipes': {
	// 								dm_src.style.left = `-${XP_APP_WIDTH}px`;
	// 								dm_src.style.zIndex = '1001';
	// 								b_transitions = true;
	// 								break;
	// 							}

	// 							case 'leaves': {
	// 								// changing threads
	// 								if(si_thread_src) {
	// 									dm_src = dm_src.cloneNode(true) as HTMLElement;
	// 									dm_exitting.replaceChildren(dm_src);
	// 								}

	// 								dm_src.style.zIndex = '1001';

	// 								await timeout(0);

	// 								// dm_src.style.left = `-${XP_APP_WIDTH}px`;
	// 								dm_src.style.transform = `translate(-${XP_APP_WIDTH}px)`;
	// 								b_transitions = true;
	// 								break;
	// 							}

	// 							case 'reveals': {
	// 								dm_src.classList.add('reveal');
	// 								b_transitions = true;
	// 								break;
	// 							}

	// 							default: {
	// 								throw new Error(`Unexpected attribute value: "${si_exit ?? ''}"`);
	// 							}
	// 						}
	// 					}
	// 				}

	// 				// not changing threads
	// 				if(!si_thread_src) {
	// 					// // src leaves
	// 					// if(d_class_list.contains('leaves')) {
	// 					// 	dm_src.style.left = `-${XP_APP_WIDTH}px`;
	// 					// 	dm_src.style.zIndex = '1001';
	// 					// 	b_transitions = true;
	// 					// }

	// 					// src slides out
	// 					if(d_class_list.contains('slides')) {
	// 						b_transitions = true;
	// 					}
	// 				}
	// 				// changing threads
	// 				else {
	// 					// going to search
	// 					if('/search' === ks_dst.pattern) {
	// 						dm_src.classList.add('sublimate');
	// 					}
	// 					// leaving search
	// 					else if('/search' === ks_src.pattern) {
	// 						ks_dst.dom.classList.remove('sublimate');
	// 					}
	// 				}

	// 				// 
	// 				await microtask();

	// 				// element is transitioning
	// 				if(!s_transition.endsWith('.bypass')) {
	// 					if(b_transitions || SX_NO_TRANSITION !== getComputedStyle(dm_src).transition) {
	// 						// wait for transition to end
	// 						dm_src.addEventListener('transitionend', function transition_end(d_event) {
	// 							// not a position property
	// 							if('transform' !== d_event.propertyName) return;

	// 							// remove self
	// 							dm_src.removeEventListener('transitionend', transition_end);

	// 							// resolve
	// 							fk_resolve();
	// 						});

	// 						// wait for callback
	// 						return;
	// 					}
	// 				}

	// 				fk_resolve();
	// 			});
	// 		},
	// 	}));
	});
	
</script>


<style lang="less">
	@import '../../style/util.less';

	.full(@type) {
		position: @type;
		width: 100%;
		height: 100%;
	}

	.full(absolute) {
		top: 0;
		left: 0;
	}

	.viewport {
		.full(relative);
		overflow: hidden;

		color: var(--theme-color-text-light);
		background-color: var(--theme-color-bg);

		>.content {
			.full(relative);
			overflow: hidden;

			width: 100%;
			height: 100%;

			&.exitting {
				position: absolute;
				top: 0;
				z-index: 1001;
				user-select: none;
				pointer-events: none;
			}

			>.thread {
				:global(&) {
					.full(absolute);
					padding-left: calc(50vw - (var(--app-max-width) / 2));
				}
			}
	
			// :global(&>section) {
			// 	position: absolute;
			// 	top: 0px;
			// 	transition: left 0.6s var(--ease-out-quick);
			// }
		}
	}
</style>

<main class="viewport" bind:this={dm_viewport}>
	<div class="content threads" bind:this={dm_threads} />
	<div class="content exitting" bind:this={dm_exitting} />
	<slot></slot>

	<ProgressSvelte />
	
	{#if b_main}
		{#await Vault.getRootKey() then dk_root}
			{#if dk_root}
				<OverscrollSvelte />
				<NavSvelte />
				<SearchSvelte />
				<VendorMenuSvelte />
				<SideMenuSvelte />
				<PopupSvelte />
				<NotificationsSvelte />
			{/if}
		{/await}
	{/if}
</main>
