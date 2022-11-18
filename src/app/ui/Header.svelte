<script lang="ts">
	import {AppApiMode} from '#/meta/app';
	import type {Promisable} from '#/meta/belt';
	
	import {createEventDispatcher, getContext, onDestroy, onMount} from 'svelte';
	
	import {ThreadId} from '../def';
	import {
		yw_account,
		yw_account_editted,
		yw_account_ref,
		yw_cancel_search,
		yw_chain,
		yw_chain_ref,
		yw_menu_vendor,
		yw_navigator,
		yw_overlay_account,
		yw_overlay_app,
		yw_overlay_network,
		yw_search,
		yw_update,
	} from '../mem';
	
	import {keplr_polyfill_script_add_matches} from '#/script/scripts';
	import {Accounts} from '#/store/accounts';
	import {Apps} from '#/store/apps';
	import {Chains} from '#/store/chains';
	
	import {Secrets} from '#/store/secrets';
	import {load_page_context} from '##/svelte';
	
	import Close from './Close.svelte';
	import Load from './Load.svelte';
	import OverlaySelect from './OverlaySelect.svelte';
	import Row from './Row.svelte';
	import StarShellLogo from './StarShellLogo.svelte';
	import PfpDisplay from '../frag/PfpDisplay.svelte';
	
	import AppView from '../screen/AppView.svelte';
	
	import SX_ICON_ARROW_LEFT from '#/icon/arrow-left.svg?raw';
	import SX_CHECKED from '#/icon/checked-circle.svg?raw';
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	import SX_CONFIRMATION from '#/icon/confirmation.svg?raw';
	import SX_ARROW_DOWN from '#/icon/expand_more.svg?raw';
	import SX_ICON_NARROW from '#/icon/narrow.svg?raw';
	import SX_ICON_SEARCH from '#/icon/search.svg?raw';
	import SX_VISIBILITY from '#/icon/visibility.svg?raw';
	
	

	/**
	 * If `true`, includes a back button to pop this page from the stack
	 */
	export let pops = false;
	const b_pops = pops;

	/**
	 * If `true`, includes an exit button to reset the stack
	 */
	export let exits = false;
	const b_exits = exits;

	/**
	 * If `true`, does not display the logo in cases where the logo would display
	 */
	export let plain = false;
	const b_plain = plain;

	/**
	 * If `true`, allows the account to be switched
	 */
	export let account = false;
	const b_account = account;

	/**
	 * If `true`, allows the network to be switched
	 */
	export let network = false;
	const b_network = network;

	// export let g_app_under: AppStruct | null = null;

	/**
	 * If `true`, includes a search input box
	 */
	export let search = false;
	const b_search = search;

	/**
	 * The primary title to display
	 */
	export let title: Promisable<string> = '';

	/**
	 * A short string to display immediately following the title
	 */
	export let postTitle: Promisable<string> = '';

	/**
	 * The subtitle to display under the primary title
	 */
	export let subtitle: Promisable<string> = '';

	// event dispatcher for parent component
	const dispatch = createEventDispatcher();

	// subscribe to update writable and dispatch updates as necessary
	yw_update.subscribe(() => {
		dispatch('update');
	});

	// dimension of the network icon
	const overlay_pfp_network_props = (s_side: 'left' | 'right') => ({
		dim: 21,
		bg: 'satin',
		genStyle: 'font-size:21px; outline:none;',
		rootStyle: `
			padding: 5px 6px;
			border: 2px solid var(--theme-color-border);
			border-radius: ${'left' === s_side? '4px 0 0 4px': '0 4px 4px 0'};
		`.replace(/\s+/g, ' '),
	}) as const;

	// dimension of the account icon
	const overlay_pfp_account_props = (b_middle: boolean) => ({
		dim: 32,
		bg: 'satin',
		classes: 'fill',
		genStyle: 'font-size:21px; outline:none;',
		rootStyle: `
			padding: 0;
			border: 2px solid var(--theme-color-border);
			border-radius: ${b_middle? '0': '4px 0 0 4px'};
		`.replace(/\s+/g, ' '),
	}) as const;

	// get page from context
	const {
		k_page,
		g_cause,
		b_searching,
	} = load_page_context();

	// deduce app path
	const p_app = g_cause?.app? Apps.pathFrom(g_cause.app): null;


	let dm_header: HTMLElement;

	let dm_search: HTMLInputElement;

	export let isSearchScreen = false;

	let s_search = $yw_search;

	// when true, the search area element overlays the header
	let b_search_area_visible = false;

	// initiates a search activity
	function initiate_search() {
		b_search_area_visible = true;
		dm_search.focus();

		// set cancel function
		$yw_cancel_search = cancel_search;
	}

	$: {
		console.log(`$yw_search: ${$yw_search}`);
	}

	// cancels the current search activity
	function cancel_search() {
		// clear search input text
		s_search = '';

		// remove focus from the input
		dm_search.blur();

		// hide the search area
		b_search_area_visible = false;

		// reset search string
		$yw_search = '';
	}

	// listen for page events
	k_page.on({
		// system fired search trigger event
		search(fk_captured) {
			if(!b_search_area_visible) {
				fk_captured?.();
				initiate_search();
			}
		},
	});

	function keydown(d_event) {
		// escape key
		if('Escape' === d_event.key) {
			// search is active
			if(b_search_area_visible) {
				// input is populated; clear it
				if($yw_search) {
					$yw_search = '';
				}
				// input is empty; cancel search
				else {
					cancel_search();
				}

				// prevent default
				d_event.preventDefault();
			}
		}
		// left arrow pops
		else if('ArrowLeft' === d_event.key) {
			// ignore on input element
			const dm_target = d_event.target;
			if('INPUT' === dm_target.nodeName) return;

			// page is poppable
			if(pops && k_page) {
				k_page.pop();
			}
		}
	}

	onMount(() => {
		addEventListener('keydown', keydown);
	});

	onDestroy(() => {
		removeEventListener('keydown', keydown);
	});

	// yw_search.subscribe((s_value) => {
	// 	if(isSearchScreen && s_value) {
	// 		s_search = s_value;
	// 		if(dm_search) {
	// 			setTimeout(() => {
	// 				dm_search.focus();
	// 			}, 0);
	// 		}
	// 	}
	// 	else if(!s_value) {
	// 		s_search = '';
	// 	}
	// });

	function update_search(d_event: Event) {
		// user typed something
		if(s_search) {
			// save search string
			$yw_search = s_search;
		}
	}

	async function enable_keplr_api() {
		const g_app = g_cause!.app!;

		// set api mode
		g_app.api = AppApiMode.KEPLR;

		// save app def to storage
		await Apps.add(g_app);

		// ensure polyfill is enabled for this app
		await keplr_polyfill_script_add_matches([Apps.scriptMatchPatternFrom(g_app)]);

		// reload the page
		await chrome.tabs.reload(g_cause!.tab.id!);

		// close the popup
		window.close();
	}

	$: s_cluster_mode = [
		g_cause?.app? 'app': '',
		b_account? 'account': '',
		b_network? 'network': '',
	].filter(s => s).join('-');

</script>

<style lang="less">
	@import '../_base.less';

	.header {
		display: flex;
		flex-direction: column;
		gap: 16px;

		&.blur {
			>*:not(.top) {
				filter: blur(2px);
			}
		}

		>*:not(.top) {
			transition: blur 400ms var(--ease-out-cubic);
		}
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;

		>.back {
			flex: 1;
			color: var(--theme-color-primary);
			cursor: pointer;
			max-width: 24px;
			margin-right: 20px;
		}

		>.logo.icon {
			--icon-diameter: 32px;
			transform: scale(1.425);
			cursor: pointer;
		}

		>.main {
			flex: 3;
			// max-width: fit-content;
			cursor: default;
			margin-right: 1em;
			min-width: 25%;

			>.title {
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;

				>.name {
					font-weight: 500;
					color: var(--theme-color-text-light);
				}

				>.symbol {
					font-weight: 400;
					color: var(--theme-color-text-med);
				}
			}

			>.subtitle {
				font-size: 12px;
				font-weight: 500;
				color: var(--theme-color-text-med);
				white-space: nowrap;
			}
		}

		>.right {
			flex: 5;
			display: flex;
			max-width: max-content;
			align-items: center;
			gap: 1em;

			// // for absolute-positioned overlay child
			// position: relative;

			&.heightless {
				height: 0;
			}

			// >.network {
			// 	flex: 3;
			// 	max-width: fit-content;
			// 	cursor: pointer;
			// 	white-space: nowrap;
			// 	margin-top: -17px;

			// 	>.icon {
			// 		--icon-color: var(--theme-color-primary);
			// 		--icon-diameter: 24px;
			// 		vertical-align: middle;
			// 		margin-left: -4px;
			// 	}
			// }

			>.cluster {
				display: inline-flex;

				// setting width to a fixed amount leaves space so that search always appears in same position
				// width: 100px;

				justify-content: end;
				@radius: 5px;

				>* {
					display: inline-flex;
				}

				// collapse adjacent borders
				>:nth-child(n+1) {
					margin-left: -2px;
				}
			}
		}
	}

	.search-area {
		position: absolute;
		left: 0;
		width: 100%;
		background-color: var(--theme-color-bg);
		padding: 0;
		box-sizing: border-box;
		transition: opacity 250ms linear;
		opacity: 0;
		pointer-events: none;

		&.visible {
			pointer-events: auto;
			opacity: 1;

			>.search-bar {
				transform: translateY(0);
			}
		}

		>.search-bar {
			transform: translateY(-64px);
			transition: transform 500ms var(--ease-out-quick);

			border-bottom: 1px solid var(--theme-color-border);
			padding-bottom: 8px;

			display: flex;

			input {
				background-color: transparent;
				flex: auto;

				&:focus {
					outline: none;
				}
			}

			.controls {
				flex-shrink: 0;
				padding-right: 8px;

				.separator {
					display: inline-block;
					width: 0px;
					border-right: 1px solid var(--theme-color-border);
				}

				.global_svg-icon {
					--svg-color-fg: var(--theme-color-primary);
					width: 48px;
					height: 48px;
					cursor: pointer;

					display: inline-flex;
					justify-content: center;
					align-items: center;
				}
			}
		}
	}

	.search-action {
		width: 32px;
		height: 32px;
		display: flex;

		border: 1px solid transparent;
		cursor: pointer;

		&:hover {
			border-color: var(--theme-color-border);
			border-radius: 4px;
		}

		.global_svg-icon {
			margin: auto;
			--icon-diameter: 20px;
			--svg-color-fg: var(--theme-color-primary);
		}
	}

	:global(.global_header-overlay-overview) {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;

		.session-log {
			>.title {
				.font(tiny);
			}
		}
	}
</style>

<div class="header no-blur" bind:this={dm_header}>  <!-- class:blur={$yw_blur} -->
	<!-- top row -->
	<div class="top">
		<!-- leftmost action/button -->
		{#if b_pops}
			<span class="back" on:click={() => k_page.pop()}>
				{@html SX_ICON_ARROW_LEFT}
			</span>
		{:else if !b_exits && !b_plain}
			<StarShellLogo showStatusDot dim={48} alt="Click to view general status" on:click={() => $yw_menu_vendor = true} />
		{/if}

		<!-- main title section on the left -->
		<span class="main">
			<div class="title">
				{#if title}
					<span class="name">
						<Load input={title} />
					</span>
					{#if postTitle}
						<span class="symbol">
							- <Load input={postTitle} />
						</span>
					{/if}
				{/if}
			</div>

			<div class="subtitle">
				<Load input={subtitle} />
			</div>
		</span>

		<!-- all top actions that appear on the right side -->
		<span class="right" class:heightless={!b_network && b_exits}>
			<slot name="right">
				<!-- dynamic search input -->
				{#if b_search && !b_searching}
					<!-- the search area overlays the rest of the header -->
					<div class="search-area" class:visible={b_search_area_visible}>
						<!-- the search bar is the foreground of the search area -->
						<div class="search-bar">
							<!-- search text input -->
							<input type="text"
								placeholder='Start typing...'
								bind:value={$yw_search}
								on:input={update_search}
								bind:this={dm_search}
							>

							<!-- controls for search -->
							<span class="controls">
								<!-- filter control -->
								<!-- <span class="global_svg-icon filter">
									{@html SX_ICON_NARROW}
								</span>

								<span class="separator">&nbsp;</span> -->

								<!-- cancel button -->
								<span class="global_svg-icon cancel" on:click={cancel_search}>
									{@html SX_ICON_CLOSE}
								</span>
							</span>
						</div>
					</div>

					<!-- the underlying icon that initiates search activity -->
					<span class="search-action" on:click={initiate_search}>
						<span class="global_svg-icon">
							{@html SX_ICON_SEARCH}
						</span>
					</span>
				{/if}

				<!-- app/account/network switch cluster -->
				{#if !b_searching}
					<span class={`cluster global_cluster-mode_${s_cluster_mode}`}>
						<!-- current app -->
						{#if (b_network || b_account) && g_cause?.app}
							<span class="app" on:click={(d_event) => {
								d_event.stopPropagation();
								$yw_overlay_app = !$yw_overlay_app;
							}}>
								<PfpDisplay
									resource={g_cause.app}
									name={g_cause.app.host}
									{...overlay_pfp_network_props('left')}
								/>
							</span>

							{#if $yw_overlay_app}
								{@const s_app_status = g_cause.registered? 'connected': 'disconnected'}

								<OverlaySelect
									title='Current App'
									status={s_app_status}
									bind:open={$yw_overlay_app}
								>
									<svelte:fragment slot="rows">
										<Row
											name={g_cause.app.host}
											pfp={g_cause.app.pfp}
											detail={g_cause.app.name}
											on:click={async(d_event) => {
												if(g_cause.registered) {
													$yw_overlay_app = false;

													// active apps thread
													await $yw_navigator.activateThread(ThreadId.APPS);

													// // reset thread
													// $yw_navigator.activeThread.reset();

													// await timeout(1e3);

													// push app view
													$yw_navigator.activePage.push({
														creator: AppView,
														props: {
															app: g_cause.app,
														},
													});
												}
												else {
													d_event.stopPropagation();
												}
											}}
											rootStyle='margin-bottom:1em;'
										>
											<svelte:fragment slot="right">
												{#if g_cause.registered}
													<span class="overlay-select icon rotate_-90deg" style="--icon-color: var(--theme-color-primary);">
														{@html SX_ARROW_DOWN}
													</span>
												{/if}
											</svelte:fragment>
		<!-- 
											<svelte:fragment slot="icon">
												<PfpDisplay dim={32} resource={g_cause.app} />
											</svelte:fragment> -->
										</Row>

										{#if !g_cause.registered}
											<div style={`
												display: flex;
											`.replace(/\s+/g, ' ')}>
												<button class="pill" on:click|stopPropagation={() => enable_keplr_api()}>
													Enable Keplr API
												</button>
											</div>
										{:else}
											{#if p_app}
												{#await Secrets.filter({
													type: 'query_permit',
													outlets: [p_app],
												}) then a_permits}
													{@const nl_permits = a_permits.length}
													<div class="global_header-overlay-overview permits">
														<span class="global_svg-icon icon-diameter_16px">
															{@html SX_CONFIRMATION}
														</span>
														<span class="title">
															{nl_permits} query permit{1 === nl_permits? '': 's'} in use
														</span>
													</div>
													<hr>
												{/await}

												{#await Secrets.filter({
													type: 'viewing_key',
													outlets: [p_app],
												}) then a_keys}
													{@const nl_keys = a_keys.length}
													<div class="global_header-overlay-overview viewing-keys">
														<span class="global_svg-icon icon-diameter_16px">
															{@html SX_VISIBILITY}
														</span>
														<span class="title">
															{nl_keys} viewing key{1 === nl_keys? '': 's'} shared with app
														</span>
													</div>
													<hr>
												{/await}
											{/if}

											<div class="session-log">
		<!-- 
												<div class="title">
													Session log
												</div> -->
											</div>
										{/if}
									</svelte:fragment>
								</OverlaySelect>
							{/if}

						{/if}

						<!-- account switcher -->
						{#if b_account}
							<span class="account" on:click={(d_event) => {
								d_event.stopPropagation();
								$yw_overlay_account = !$yw_overlay_account;
							}}>
								{#key $yw_account}
									<PfpDisplay
										resource={$yw_account}
										updates={$yw_account_editted}
										{...overlay_pfp_account_props(!!g_cause?.app)}
									/>
								{/key}

							</span>

							{#if $yw_overlay_account}
								<OverlaySelect
									title='Switch Account'
									bind:open={$yw_overlay_account}
								>
									<svelte:fragment slot="rows">
										{#await Accounts.read()}
											...
										{:then ks_accounts}
											<!-- {#if ks_accounts.entries().length > 2}
												<Row
													name="All Accounts"
													detail={format_fiat(Object.values(H_ACCOUNTS).reduce((c_sum, k_account) => c_sum + (k_account.aggregator? 0: Holding.usdSum(k_account.holdings(H_HOLDINGS, $yw_chain), H_TOKENS, H_VERSUS_USD)), 0))}
													on:click={() => {
														const p_account_all = Account.refFromId('*');
														$yw_account = H_ACCOUNTS[p_account_all];
														$yw_overlay_account = false;
													}}
												>
													<svelte:fragment slot="right">
														{#if $yw_account.def.iri === Account.refFromId('*')}
															<span class="overlay-select icon">
																{@html SX_CHECKED}
															</span>
														{/if}
													</svelte:fragment>

													<svelte:fragment slot="icon">
														<span class="pfp square icon aggregator" style="display: inline-block; font-size:30px; margin-left:auto; margin-right:auto;">
															A
														</span>

													</svelte:fragment>
												</Row>
											{/if}
											-->

											<!-- {#each ks_accounts.entries().filter(([,k]) => !k.aggregator) as [p_account, k_account]} -->
											{#each ks_accounts.entries() as [p_account, g_account]}
												<Row
													resource={g_account}
													resourcePath={p_account}
													detail={g_account.extra?.total_fiat_cache ?? '(?)'}
													on:click={() => {
														$yw_account_ref = p_account;
														$yw_overlay_account = false;
													}}
												>
													<svelte:fragment slot="right">
														{#if $yw_account_ref === p_account}
															<span class="overlay-select icon" style="--icon-color: var(--theme-color-primary);">
																{@html SX_CHECKED}
															</span>
														{/if}
													</svelte:fragment>

													<svelte:fragment slot="icon">
														<PfpDisplay dim={32} resource={g_account} />
													</svelte:fragment>
												</Row>
											{/each}
										{/await}
									</svelte:fragment>
								</OverlaySelect>
							{/if}
						{/if}

						<!-- network switcher -->
						{#if b_network}
							<span class="network" on:click={(d_event) => {
								d_event.stopPropagation();
								$yw_overlay_network = !$yw_overlay_network;
							}}>
								{#key $yw_chain}
									<PfpDisplay
										resource={$yw_chain}
										{...overlay_pfp_network_props('right')}
									/>
								{/key}
							</span>

							{#if $yw_overlay_network}
								<OverlaySelect
									title='Switch Network'
									bind:open={$yw_overlay_network}
								>
									<svelte:fragment slot="rows">
										{#await Chains.read()}
											...
										{:then ks_chains} 
											{#each ks_chains.entries() as [p_chain, g_chain]}
												<Row
													resource={g_chain}
													detail='Default Provider'
													on:click={() => {
														$yw_chain_ref = p_chain;
														$yw_overlay_network = false;
													}}
												>
													<svelte:fragment slot="right">
														{#if $yw_chain_ref === p_chain}
															<span class="overlay-select icon" style="--icon-color: var(--theme-color-primary);">
																{@html SX_CHECKED}
															</span>
														{/if}
													</svelte:fragment>
												</Row>
											{/each}
										{/await}
									</svelte:fragment>
								</OverlaySelect>
							{/if}
						{/if}


					</span>
				{/if}

				<!-- exit button -->
				{#if b_exits}
					<Close on:click={() => dispatch('close')} />
				{/if}
			</slot>
		</span>
	</div>
</div>
