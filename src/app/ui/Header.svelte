<script lang="ts">
	import { createEventDispatcher, getContext } from 'svelte';

	import StarShellLogo from './StarShellLogo.svelte';
	import OverlaySelect from './OverlaySelect.svelte';
	import PfpDisplay from './PfpDisplay.svelte';
	import Close from './Close.svelte';
	import Row from './Row.svelte';

	import SX_ICON_ARROW_LEFT from '#/icon/arrow-left.svg?raw';
	import SX_ICON_SEARCH from '#/icon/search.svg?raw';
	import SX_CHECKED from '#/icon/checked-circle.svg?raw';
	
	import {
		yw_account,
		yw_account_ref,
		yw_cancel_search,
		yw_chain,
		yw_chain_ref,
		yw_menu_vendor,
		yw_overlay_account,
		yw_overlay_network,
		yw_search,
		yw_thread,
	} from '../mem';

	import type {
		Page,
	} from '##/screen/_screens';
	import { Chains } from '#/store/chains';
	import { Accounts } from '#/store/accounts';
	import { qs } from '#/util/dom';
	
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

	/**
	 * If `true`, includes a search input box
	 */
	export let search = false;
	const b_search = search;

	/**
	 * The primary title to display
	 */
	export let title = '';
	// const s_title = title;

	/**
	 * A short string to display immediately following the title
	 */
	export let symbol = '';
	// const s_symbol = symbol;

	/**
	 * The substitle to display under the primary title
	 */
	export let subtitle = '';
	const s_subtitle = subtitle;

	// event dispatcher for parent component
	const dispatch = createEventDispatcher();

	// dimension of the account and network icons
	const overlay_pfp_props = (b_mirror=false) => ({
		dim: 21,
		bg: 'satin',
		genStyle: 'font-size:21px; outline:none;',
		rootStyle: `
			padding: 5px 6px;
			border: 2px solid var(--theme-color-border);
			border-radius: ${b_mirror? '0 4px 4px 0': '4px 0 0 4px'};
		`.replace(/\s+/g, ' '),
	}) as const;

	// get page from context
	const k_page = getContext<Page>('page');

	// $: p_account_icon = b_account? $yw_account?.def?.iconRef: null;


	let dm_header: HTMLElement;

	let dm_search: HTMLElement;

	// import SX_SEARCH from '@material-design-icons/svg/filled/search.svg?raw';

	// import SX_LOGO from '#/asset/vendor/logo.svg?raw';
	// import SX_DROP_DOWN from '#/asset/nav/drop-down.svg?raw';

	// import SX_CHECKED from '#/asset/nav/checked-circle.svg?raw';

	// import Put from './Put.svelte';
	// import { format_fiat, H_ACCOUNTS, H_CHAINS, H_HOLDINGS, H_ICONS, H_TOKENS, H_VERSUS_USD } from '#/sim/data';
	// import { microtask, ode, timeout } from '#/util/belt';
	// import { qs } from '#/util/dom';
	// import Close from './Close.svelte';
	// import OverlaySelect from './OverlaySelect.svelte';
	// import Row from './Row.svelte';

	// import {
	// 	Account,
	// 	Icon,
	// 	Holding,
	// } from '#/objects';
	// import Pfp from './Pfp.svelte';



	export let isSearchScreen = false;
	export let search_input = '';

	let s_search = $yw_search;


	// onMount(() => {
	// 	if($yw_search) {
	// 		setTimeout(() => {
	// 			console.log('stealing focus for entry search');
	// 			dm_search.focus();
	// 		}, 0);
	// 	}
	// });

	yw_search.subscribe((s_value) => {
		if(isSearchScreen && s_value) {
			console.log('search screen and search text');
			s_search = s_value;
			if(dm_search) {
				setTimeout(() => {
					dm_search.focus();
				}, 0);
			}
		}
		else if(!s_value) {
			s_search = '';
		}
	});

	function update_search(d_event: Event) {
		// currently in search thread
		if(isSearchScreen) {
			// search is being cancelled
			if(!s_search) {
				$yw_search = '';
				$yw_cancel_search();
			}
			else {
				dispatch('search', s_search);
			}
		}
		// not search screen, but user typed something
		else if(s_search) {
			const si_cache = $yw_thread.id;

			const dm_focus = qs(dm_header, ':focus') as HTMLElement;
			if(dm_focus) {
				dm_focus.blur();
			}

			// dm_header.style.visibility = 'hidden';

			// const dm_clone = $yw_screen_dom.cloneNode(true) as HTMLElement;
			// $yw_exitting_dom.append(dm_clone)

			// $yw_header_props = {
			// 	pops,
			// 	account,
			// 	network,
			// 	search,
			// 	name,
			// 	symbol,
			// 	subname,
			// 	search_input: $yw_search,
			// };

			$yw_cancel_search = () => {
				// dm_header.style.visibility = 'visible';
				// $yw_search = '';

				// $yw_thread_id = si_cache;

				s_search = '';

				console.log('stealing focus for cancel search');
				dm_search.focus();
			};


			// save search string
			$yw_search = s_search;

			// // set thread
			// $yw_thread_id = ThreadId.SEARCH;
		}
	}

	// async function search_input() {
	// 	await tick();
	// 	debugger;
	// 	if(s_search_input) {
	// 		if(ThreadId.SEARCH !== $yw_thread_id) {
	// 			dm_header.style.visibility = 'hidden';
	// 			// const dm_clone = dm_header.cloneNode(true);
				
	// 			$yw_thread_id = ThreadId.SEARCH;
	// 		}
	// 	} 
	// }

</script>

<style lang="less">
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
				@radius: 5px;

				>* {
					display: inline-flex;
				}

				// collapse adjacent borders
				>:nth-child(n+1) {
					margin-left: -2px;
				}

				// >span.network {
				// 	--icon-diameter: 26px;
				// 	--button-diameter: 32px;
				// 	margin-bottom: -1px;
				// }

				// >.account,>.network {
				// 	--icon-diameter: 32px;

				// 	flex: 1;
				// 	max-width: var(--icon-diameter);
				// 	min-width: var(--icon-diameter);
				// 	margin-bottom: -5px;
				// 	cursor: pointer;

				// 	.face {
				// 		display: inline-block;
				// 		width: var(--icon-diameter);
				// 		height: var(--icon-diameter);
				// 		border-radius: var(--icon-diameter);
				// 		background-color: var(--theme-color-primary);
				// 	}
				// }
			}
		}
	}

	.search {
		font-weight: 400;
		position: relative;

		>.action {
			--icon-diameter: 20px;
			width: var(--icon-diameter);
			height: var(--icon-diameter);
			fill: var(--theme-color-text-light);

			position: absolute;
			right: 12px;
			top: calc(50% - (var(--icon-diameter) / 2));

			>svg {
				:global(&) {
					width: 100%;
					height: 100%;
				}
			}
		}
	}
</style>

<div class="header" bind:this={dm_header}>  <!-- class:blur={$yw_blur} -->
	<!-- top row -->
	<div class="top">
		<!-- leftmost action/button -->
		{#if b_pops}
			<span class="back" on:click={() => k_page.pop()}>
				{@html SX_ICON_ARROW_LEFT}
				<!-- <ArrowBackIcon size='24px' /> -->
				<!-- <img src="/media/nav/arrow-left.svg" alt="Click to go back" /> -->
			</span>
		{:else if !b_exits && !b_plain}
			<StarShellLogo dim={48} alt="Click to view general status" on:click={() => $yw_menu_vendor = true} />
		{/if}

		<!-- main title section on the left -->
		<span class="main">
			<div class="title">
				{#if title}
					<span class="name">
						{title}
					</span>
					{#if symbol}
						<span class="symbol">
							- {symbol}
						</span>
					{/if}
				{/if}
			</div>

			<div class="subtitle">
				{s_subtitle}
			</div>
		</span>

		<!-- all top actions that appear on the right side -->
		<span class="right" class:heightless={!b_network && b_exits}>
			<!-- account/network switch cluster -->
			<span class="cluster">
				<!-- network switcher -->
				{#if b_network}
					<span class="network" on:click={(d_event) => {
						d_event.stopPropagation();
						$yw_overlay_network = !$yw_overlay_network;
					}}>
						{#key $yw_chain}
							<PfpDisplay
								resource={$yw_chain}
								{...overlay_pfp_props(false)}
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

				<!-- account switcher -->
				{#if b_account}
					<span class="account" on:click={(d_event) => {
						d_event.stopPropagation();
						$yw_overlay_account = !$yw_overlay_account;
					}}>
						{#key $yw_account}
							<PfpDisplay
								resource={$yw_account}
								{...overlay_pfp_props(true)}
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
			</span>

			<!-- exit button -->
			{#if b_exits}
				<Close on:click={() => dispatch('close')} />
			{/if}
		</span>
	</div>
	{#if b_search}
		<div class="search">
			<input type="text"
				autofocus={isSearchScreen}
				placeholder='Search anything: token, account, contact, txn...'
				bind:value={s_search}
				on:input={update_search}
				bind:this={dm_search}
			>
			<span class="action">
				<!-- <img src="/assets/media/nav/search.svg" alt="" /> -->
				{@html SX_ICON_SEARCH}
			</span>
		</div>
	{/if}
</div>
