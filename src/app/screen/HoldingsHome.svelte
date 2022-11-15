<script lang="ts">
	import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';

	import type {Dict, JsonObject, Promisable} from '#/meta/belt';
	import type {ContractStruct, CoinInfo, FeeConfig} from '#/meta/chain';
	import type {Cw} from '#/meta/cosm-wasm';
	import type {TxPending} from '#/meta/incident';
	import type {Snip20} from '#/schema/snip-20-def';
	
	import {ViewingKeyError} from '#/schema/snip-2x-const';
	
	import BigNumber from 'bignumber.js';
	import {getContext, onDestroy} from 'svelte';
	
	import {Header, Screen, type Page} from './_screens';
	import {syserr} from '../common';
	import {yw_account, yw_account_ref, yw_chain, yw_chain_ref, popup_receive, yw_network, yw_owner, yw_doc_visibility} from '../mem';
	
	import {as_amount, to_fiat} from '#/chain/coin';
	import {amino_to_base} from '#/chain/cosmos-msgs';
	import {token_balance} from '#/chain/token';
	import {global_receive} from '#/script/msg-global';
	import {subscribe_store} from '#/store/_base';
	import {Accounts} from '#/store/accounts';
	import {G_APP_STARSHELL} from '#/store/apps';
	import {Contracts} from '#/store/contracts';
	import {Entities} from '#/store/entities';
	import {Incidents} from '#/store/incidents';
	import type {BalanceBundle} from '#/store/providers';
	import {forever, ode} from '#/util/belt';
	import {abort_signal_timeout, open_external_link} from '#/util/dom';
	import {format_fiat} from '#/util/format';
	
	import HoldingView from './HoldingView.svelte';
	import RequestSignature from './RequestSignature.svelte';
	import Send from './Send.svelte';
	import TokensAdd from './TokensAdd.svelte';
	import Address from '../frag/Address.svelte';
	import Portrait from '../frag/Portrait.svelte';
	import TokenRow from '../frag/TokenRow.svelte';
	import Row from '../ui/Row.svelte';
	


	// get page from context
	const k_page = getContext<Page>('page');

	let yg_total = new BigNumber(0);
	let c_balances = 0;
	const b_balances_ready = true;
	let a_no_gas: string[] = [];

	let c_updates = 0;
	subscribe_store(['chains', 'contracts', 'incidents'], () => {
		console.info(`HoldingsHome.svelte observed store update; reloading...`);
		c_updates++;
	}, onDestroy);

	const f_unregister = global_receive({
		transferReceive() {

		},
	});

	yw_doc_visibility.subscribe((s_state) => {
		if('visible' === s_state) {
			c_updates += 1;
		}
	});

	onDestroy(() => {
		f_unregister();
	});

	let fk_resolve_total: (s_total: string) => void;
	let dp_total = new Promise<string>((fk_resolve) => {
		fk_resolve_total = fk_resolve;
	});

	let g_chain_cached = $yw_chain;
	$: {
		if($yw_chain !== g_chain_cached) {
			g_chain_cached = $yw_chain;
			yg_total = new BigNumber(0);
			c_balances = 0;
			dp_total = new Promise<string>((fk_resolve) => {
				fk_resolve_total = fk_resolve;
			});
			a_no_gas = [];
		}
	}


	function check_total() {
		c_balances -= 1;
		if(b_balances_ready && !c_balances) {
			const s_total = format_fiat(yg_total.toNumber(), 'usd');
			fk_resolve_total(s_total);

			// save to cache
			void Accounts.update($yw_account_ref, g_account => ({
				extra: {
					...g_account.extra,
					total_fiat_cache: s_total,
				},
			}));
		}
	}

	type Submitter = (z_out: Promisable<BigNumber>) => Promise<BigNumber>;

	async function load_native_balances() {
		let h_balances: Dict<BalanceBundle>;
		try {
			h_balances = await $yw_network.bankBalances($yw_owner);
		}
		catch(e_network) {
			if(e_network instanceof Error) {
				if(e_network.message.includes('Response closed without headers')) {
					const g_provider = $yw_network.network;

					syserr({
						title: 'Network Error',
						text: `Your network provider "${g_provider.name}" is offline: <${g_provider.grpcWebUrl}>`,
					});
				}
				else {
					syserr({
						title: 'Network Error',
						error: e_network,
					});
				}
			}
			else {
				syserr({
					title: 'Unknown Error',
					text: e_network+'',
				});
			}

			return [];
		}

		const a_outs: [string, CoinInfo, Coin, Submitter][] = [];

		// reset
		a_no_gas.length = 0;

		for(const [si_coin, g_coin] of ode($yw_chain.coins)) {
			const g_bundle = h_balances[si_coin];

			if(!g_bundle || '0' === g_bundle.balance.amount) {
				a_no_gas.push(si_coin);
			}

			c_balances += 1;

			a_outs.push([
				si_coin,
				$yw_chain.coins[si_coin],
				g_bundle?.balance || {amount:'0', denom:g_coin.denom},
				async(z_out: Promisable<BigNumber>): Promise<BigNumber> => {
					const yg_balance = await z_out;

					yg_total = yg_total.plus(yg_balance);

					check_total();
					return yg_balance;
				},
			]);
		}

		if(!a_outs.length) {
			c_balances += 1;
			check_total();
		}

		a_no_gas = a_no_gas;

		return a_outs;
	}

	let h_pending_txs: Dict<JsonObject> = {};

	async function load_tokens() {
		const a_tokens = await Contracts.filterTokens({
			on: 1,
			chain: $yw_chain_ref,
			interfaces: {
				snip20: {},
			},
		});

		h_pending_txs = {};

		// load incidents
		const a_pending = await Incidents.filter({
			type: 'tx_out',
			stage: 'pending',
		});

		for(const g_pending of a_pending) {
			const h_events = (g_pending.data as TxPending).events;

			for(const g_exec of h_events.executions || []) {
				h_pending_txs[g_exec.contract] = g_exec.msg;
			}
		}

		// update pending txs
		h_pending_txs = h_pending_txs;

		// reset zero balance tokens
		a_zero_balance_tokens = [];

		return a_tokens;
	}

	const H_FAUCETS: Dict<string[]> = {
		'theta-testnet-001': [
			'https://discord.com/channels/669268347736686612/953697793476821092',
		],
		'pulsar-2': [
			'https://faucet.starshell.net/',
			'https://faucet.pulsar.scrttestnet.com/',
			'https://pulsar.faucet.trivium.network/',
			'https://faucet.secrettestnet.io/',
		],
	};

	async function best_faucet(): Promise<string> {
		const a_faucets = H_FAUCETS[$yw_chain.reference];

		// ping each faucet to find best one
		try {
			// bias StarShell since it gives 100 SCRT and no IP limiting
			try {
				const d_res_0 = await fetch(a_faucets[0], {
					headers: {
						accept: 'text/html',
					},
					method: 'HEAD',
					credentials: 'omit',
					cache: 'no-store',
					referrer: '',
					mode: 'no-cors',
					redirect: 'error',
					signal: abort_signal_timeout(2e3).signal,
				});

				return d_res_0.url;
			}
			catch(e_req) {}

			// send preflight requests
			const d_res = await Promise.any(a_faucets.map(async p => fetch(p, {
				headers: {
					accept: 'text/html',
				},
				method: 'HEAD',
				credentials: 'omit',
				cache: 'no-store',
				referrer: '',
				mode: 'no-cors',
				redirect: 'error',
				signal: abort_signal_timeout(6e3).signal,
			})));

			console.log(`Using best faucet: ${d_res.url}`);

			// return first valid response
			return d_res.url;
		}
		// ignore network errors and timeouts
		catch(e) {}

		// default to original
		return a_faucets[0];
	}

	let a_zero_balance_tokens: ContractStruct[] = [];

	async function load_token_balance(g_contract: ContractStruct) {
		const g_balance = await token_balance(g_contract, $yw_account, $yw_network);

		if(g_balance) {
			if(g_balance.yg_amount.eq(0) && !a_zero_balance_tokens.find(g => g.bech32 === g_contract.bech32)) {
				a_zero_balance_tokens = a_zero_balance_tokens.concat([g_contract]);
			}

			return g_balance;
		}

		return null;
	}

	async function mint_tokens() {
		if($yw_chain.features.secretwasm) {
			// ref chain
			const g_chain = $yw_chain;

			// mint message
			const a_msgs_proto = await Promise.all(a_zero_balance_tokens.map(async(g_contract) => {
				const g_msg: Snip20.MintableMessageParameters<'mint'> = {
					mint: {
						amount: BigNumber(1000).shiftedBy(g_contract.interfaces.snip20.decimals).toString() as Cw.Uint128,
						recipient: $yw_owner,
					},
				};

				// prep snip-20 exec
				const g_exec = await $yw_network.encodeExecuteContract($yw_account, g_contract.bech32, g_msg, g_contract.hash);

				// convert to proto message for signing
				return amino_to_base(g_exec.amino).encode();
			}));

			// prep proto fee
			const gc_fee: FeeConfig = {
				limit: BigInt($yw_chain.features.secretwasm!.snip20GasLimits.mint) * BigInt(a_msgs_proto.length),
			};

			k_page.push({
				creator: RequestSignature,
				props: {
					protoMsgs: a_msgs_proto,
					fee: gc_fee,
					broadcast: {},
					local: true,
				},
				context: {
					chain: g_chain,
					accountPath: $yw_account_ref,
					app: G_APP_STARSHELL,
				},
			});
		}
	}
</script>

<style lang="less">
	@import '../_base.less';

	.testnet-reminder {
		.font(tiny);
		text-align: center;
		color: var(--theme-color-text-med);
		transform: scaleX(1.25);
		margin-bottom: calc(0px - var(--ui-padding) - var(--inline-padding));
	}

	.subinfo {
		border-top: 1px solid var(--theme-color-border);
		padding-top: var(--ui-padding);
	}

	.no-gas {
		display: flex;
		flex-direction: column;
		gap: var(--inline-padding);
		.message {
			.font(tiny);
		}
	}

	.owner-address {
	}

</style>

<Screen debug='HoldingsHome' nav root keyed>

	<Header search network account on:update={() => c_updates++}>
		<svelte:fragment slot="title">

		</svelte:fragment>
	</Header>

	{#if $yw_chain.testnet}
		<div class="testnet-reminder no-margin">
			TESTNET
		</div>
	{/if}

	{#key c_updates}

		<!-- title={format_fiat(x_usd_balance)} -->
		<Portrait
			noPfp
			title={dp_total}
			subtitle={$yw_account.name}
			resource={$yw_account}
			resourcePath={$yw_account_ref}
			actions={{
				send: {
					label: 'Send',
					trigger() {
						k_page.push({
							creator: Send,
							props: {
								from: $yw_account,
							},
						});
					},
				},
				recv: {
					label: 'Receive',
					trigger() {
						popup_receive($yw_account_ref);
					},
				},
				add: {
					label: 'Add Token',
					trigger() {
						k_page.push({
							creator: TokensAdd,
						});
					},
				},
			}}
		/>

		{#key $yw_chain}
			{#if a_no_gas.length}
				<div class="no-gas text-align_center subinfo">
					<div class="message">
						<span class="warning">Warning:</span> you don't have any {$yw_chain.testnet? 'testnet ':''}{a_no_gas.join(' or ')} to pay gas fees.
					</div>

					<div class="buttons">
						{#if $yw_chain.testnet}
							{#await best_faucet()}
								<button class="pill" on:click={() => open_external_link(H_FAUCETS[$yw_chain.reference][0])}>Get {a_no_gas.join(' or ')} from faucet</button>
							{:then p_faucet}
								<button class="pill" on:click={() => open_external_link(p_faucet)}>Get {a_no_gas.join(' or ')} from faucet</button>
							{/await}
						{:else}
							<button class="pill">Buy {a_no_gas.join(' or ')}</button>
						{/if}
					</div>
				</div>
			{:else if a_zero_balance_tokens.length > 1}
				<div class="zero-balance-tokens text-align_center subinfo">
					<div class="message">
						Want to mint all of your testnet tokens?
					</div>

					<div class="buttons">
						<button class="pill" on:click={() => mint_tokens()}>
							Mint {a_zero_balance_tokens.length} tokens.
						</button>
					</div>
				</div>
			{/if}

			<div class="owner-address subinfo">
				<Address address={$yw_owner} copyable='icon' />
			</div>
		{/key}
		
	<!-- 
		<Gap />

		<div class="rows no-margin">
			<Row
				name={`Staked`}
			/>
		</div> -->

		<!-- {#key a_holdings}
			<HoldingsList holdings={a_holdings} />
		{/key} -->

		{#key $yw_network}
			<div class="rows no-margin border-top_black-8px">
				<!-- native coin(s) -->
				{#await load_native_balances()}
					{#each ode($yw_chain.coins) as [si_coin, g_bundle]}
						{@const p_entity = Entities.holdingPathFor($yw_owner, si_coin)}
						<Row lockIcon detail='Native Coin'
							name={si_coin}
							pfp={$yw_chain.pfp}
							amount={forever('')}
							on:click={() => {
								k_page.push({
									creator: HoldingView,
									props: {
										holdingPath: p_entity,
									},
								});
							}}
						/>
					{/each}
				{:then a_balances}
					{#each a_balances as [si_coin, g_coin, g_balance, f_submit]}
					{@const p_entity = Entities.holdingPathFor($yw_owner, si_coin)}
						{@const g_resource = {
							name: si_coin,
							pfp: $yw_chain.pfp,
						}}
						{@const dp_worth = f_submit(to_fiat(g_balance, g_coin))}
						<Row lockIcon detail='Native Coin'
							postnameTags
							resourcePath={p_entity}
							resource={g_resource}
							amount={as_amount(g_balance, g_coin)}
							fiat={dp_worth.then(yg => format_fiat(yg.toNumber(), 'usd'))}
							on:click={() => {
								k_page.push({
									creator: HoldingView,
									props: {
										holdingPath: p_entity,
									},
								});
							}}
						>
						</Row>
					{/each}
				{/await}

				{#await load_tokens()}
					<Row
						name={forever('')}
						amount={forever('')}
					/>
				{:then a_tokens}
					{#each a_tokens as g_token}
						{#await load_token_balance(g_token)}
							<TokenRow contract={g_token} balance />
						{:then g_balance}
							{#if h_pending_txs[g_token.bech32]}
								<TokenRow contract={g_token} pending balance />
							{:else if g_balance}
								{#if '0' !== g_balance.s_amount}
									<TokenRow contract={g_token} balance={g_balance} />
								{:else}
									<TokenRow contract={g_token} balance={g_balance} mintable />
								{/if}
							{:else}
								<TokenRow contract={g_token} unauthorized />
							{/if}
						{:catch e_load}
							{#if e_load instanceof ViewingKeyError}
								<TokenRow contract={g_token} error={'Viewing Key Error'} on:click_error={() => {
									k_page.push({
										creator: TokensAdd,
										props: {
											suggested: [g_token],
										},
									});
								}} />
							{:else}
								<TokenRow contract={g_token} error={'Error'} />
							{/if}
						{/await}
					{/each}
				{/await}
			</div>
		{/key}
	{/key}
</Screen>
