<script lang="ts">
	import type {AccountStruct} from '#/meta/account';
	import type {Bech32} from '#/meta/chain';
	
	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {load_app_context} from '../svelte';
	
	import {produce_contracts} from '#/chain/contract';
	import type {SecretNetwork} from '#/chain/secret-network';
	import {Accounts} from '#/store/accounts';
	import {Contracts} from '#/store/contracts';
	import {Providers} from '#/store/providers';
	
	import {SecretNodes} from '#/store/web-apis';
	import {fold, F_NOOP, oderac} from '#/util/belt';
	import {open_external_link} from '#/util/dom';
	import {format_amount} from '#/util/format';
	
	import RequestSignature from './RequestSignature.svelte';
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField from '../ui/CheckboxField.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Load from '../ui/Load.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	
	import SX_ICON_EXTERNAL from '#/icon/external.svg?raw';


	const {
		g_chain,
		p_chain,
		p_account,
		k_page,
		g_app,
		g_cause,
		completed,
	} = load_app_context();

	export let bech32s: Bech32[] = [];

	let f_request_signature: null|VoidFunction = null;

	let ks_contracts: Awaited<ReturnType<typeof Contracts['read']>>;

	let g_account!: AccountStruct;

	let k_network!: SecretNetwork;

	const dp_load = (async function load() {
		// init fields
		await Promise.all([
			Contracts.read().then(ks => ks_contracts = ks),
			Accounts.at(p_account).then(g => g_account = g!),
			Providers.activateStableDefaultFor<SecretNetwork>(g_chain).then(async(_k_network) => {
				k_network = _k_network;

				// do a quick test
				try {
					await Providers.quickTest(k_network.provider, g_chain);
				}
				catch(e_check) {
					throw syserr(e_check as Error);
				}
			}),
		]);

		// build messages
		await rebuild();
	})();

	async function rebuild() {
		// reset
		f_request_signature = null;

		// nothing checked
		if(!a_adding.length) return;

		if(g_chain?.features.secretwasm) {
			// generate viewing key messages
			const a_msgs_proto = await Promise.all(a_adding.map(async(sa_bech32) => {
				const g_token = {
					bech32: sa_bech32,
					hash: ks_contracts.at(Contracts.pathFor(p_chain, sa_bech32))?.hash || '',
					chain: p_chain,
				};

				// construct wasm message
				const g_exec = await Snip2xMessageConstructor.generate_viewing_key(g_account, g_token, k_network);

				// as proto
				return g_exec.proto;
			}));

			f_request_signature = () => {
				k_page.push({
					creator: RequestSignature,
					props: {
						protoMsgs: a_msgs_proto,
						fee: {
							// TODO: support non-secretwasm chains
							limit: BigInt(g_chain.features.secretwasm!.snip20GasLimits.set_viewing_key) * BigInt(a_msgs_proto.length),
						},
						broadcast: true,
					},
				});
			};
		}
		else {
			throw syserr(new Error('Chain not supported'));
		}
	}

	let b_disabled = false;

	function reject() {
		b_disabled = true;
		completed(false);
	}

	let b_tooltip_showing = false;

	const h_checked: Record<Bech32, boolean> = fold(bech32s, sa_contract => ({
		[sa_contract]: true,
	}));

	let a_adding = bech32s;
	function update_checked() {
		a_adding = oderac(h_checked, (sa_contract, b_checked) => b_checked? sa_contract: void 0) as Bech32[];
		void rebuild();
	}
</script>

<style lang="less">
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}

		100% {
			transform: rotate(360deg);
		}
	}

	section {
		margin-top: 4em !important;
		display: flex;
		flex-direction: column;

		.loading {
			margin: 0 auto;
			width: 60%;

			img {
				width: 100%;
				animation: spin 3s linear infinite;
			}
		}

		p {
			margin-top: 4em;
			text-align: center;
		}
	}

	.contract-stats {
		font-size: 12px;
		color: var(--theme-color-graysoft);
		display: flex;
		gap: 6px;

		>*:not(:last-child) {
			padding-right: 6px;
			border-right: 1px solid var(--theme-color-border);
		}
	}
</style>

<Screen>
	{@const s_token_plurality = 1 === bech32s.length? '': 's'}
	{#if !g_account}
		<AppBanner app={g_app} chain={g_chain} on:close={reject}>
			<span slot="default" style="display:contents;">
				Add Token{s_token_plurality}?
			</span>
			<span slot="context" style="display:contents;">
				[...]
			</span>
		</AppBanner>
	{:else}
		<AppBanner app={g_app} chain={g_chain} account={g_account} on:close={reject}>
			<span slot="default" style="display:contents;">
				<!-- let the title appear with the tooltip -->
				<span style="position:relative; z-index:16;">
					Add Token{s_token_plurality}?
				</span>
				<Tooltip bind:showing={b_tooltip_showing}>
					<p>
						The app is requesting you add the given token{s_token_plurality} to your wallet.
					</p>
					<p>
						This is optional, but the app might require the token{s_token_plurality} to continue.
					</p>
					<p>
						Adding the token{s_token_plurality} will not automatically grant the app viewing permissions.
					</p>
				</Tooltip>
			</span>
			<span slot="context" style="display:contents;">
				{g_account?.name || ''}
			</span>
		</AppBanner>
	{/if}

	{#await dp_load}
		<section>
			<div class="loading">
				<img src="/media/vendor/loading.svg" alt="Loading">
			</div>
		</section>
	{:then}
		<div class="rows no-margin">
			{#await produce_contracts(bech32s, g_chain, g_cause?.app || g_app)}
				<LoadingRows count={bech32s.length} />
			{:then a_contracts}
				{#each a_contracts as g_contract}
					<!-- TODO: make toggle-able -->
					<!-- TODO: represent NFTs too? -->
					<Row resource={g_contract}
						name={g_contract.interfaces.snip20?.symbol || '??'}
						postname={g_contract.name}
						address={g_contract.bech32} copyable
					>
						<span slot="right" style="margin-left: 1.5em;">
							<CheckboxField id="add-${g_contract.bech32}"
								bind:checked={h_checked[g_contract.bech32]}
								on:change={update_checked}
							>
							</CheckboxField>
						</span>

						<span slot="below" class="contract-stats">
							<span class="global_svg-icon icon-diameter_18px link"
								on:click={() => open_external_link(SecretNodes.urlFor(g_chain, g_contract))}
							>
								{@html SX_ICON_EXTERNAL}
							</span>

							{#await SecretNodes.contractStats(g_chain, g_contract)}
								<span>
									<Load forever />
								</span>
								<span>
									<Load forever />
								</span>
								<span>
									<Load forever />
								</span>
							{:then g_stats}
								<span>
									{format_amount(+g_stats.value_locked, true)} SCRT locked
								</span>
								<span>
									{format_amount(+g_stats.txs_count, true)} txs
								</span>
								<span>
									{format_amount(+g_stats.accounts_count, true)} accs
								</span>
							{/await}
						</span>
					</Row>
				{/each}
			{/await}
		</div>
	{/await}


	<ActionsLine deny cancel={reject} confirm={['Accept', F_NOOP, !f_request_signature]} disabled={b_disabled} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>
