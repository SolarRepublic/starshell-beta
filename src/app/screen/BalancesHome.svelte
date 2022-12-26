<script lang="ts">
	import type {Coin} from '@solar-republic/cosmos-grpc/dist/cosmos/base/v1beta1/coin';
	
	import type {Dict, JsonObject, Promisable} from '#/meta/belt';
	import type {ContractStruct, CoinInfo, FeeConfig} from '#/meta/chain';
	import type {Cw} from '#/meta/cosm-wasm';
	import type {TxPending} from '#/meta/incident';
	import type {Snip20} from '#/schema/snip-20-def';
	
	import {Snip2xToken, ViewingKeyError} from '#/schema/snip-2x-const';
	
	import BigNumber from 'bignumber.js';
	import {getContext, onDestroy} from 'svelte';
	
	import {Header, Screen, type Page} from './_screens';
	import {syserr} from '../common';
	import {yw_account, yw_account_ref, yw_chain, yw_chain_ref, popup_receive, yw_network, yw_owner, yw_doc_visibility, yw_progress} from '../mem';
	
	import {make_progress_timer} from '../svelte';
	
	import {as_amount, coin_to_fiat} from '#/chain/coin';
	import {amino_to_base} from '#/chain/cosmos-msgs';
	import {FeeGrants} from '#/chain/fee-grant';
	import {address_to_name} from '#/chain/messages/_util';
	import type {SecretNetwork} from '#/chain/secret-network';
	import {token_balance} from '#/chain/token';
	import {global_receive} from '#/script/msg-global';
	import {subscribe_store} from '#/store/_base';
	import {Accounts} from '#/store/accounts';
	import {G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Contracts} from '#/store/contracts';
	import {Entities} from '#/store/entities';
	import {Incidents} from '#/store/incidents';
	import type {BalanceBundle} from '#/store/providers';
	import {forever, microtask, ode, remove, timeout_exec} from '#/util/belt';
	import {abort_signal_timeout, open_external_link} from '#/util/dom';
	import {format_amount, format_fiat} from '#/util/format';
	
	import HoldingView from './HoldingView.svelte';
	import RequestSignature from './RequestSignature.svelte';
	import Send from './Send.svelte';
	import TokensAdd from './TokensAdd.svelte';
	import AddressResourceControl from '../frag/AddressResourceControl.svelte';
	import AllowanceResourceControl from '../frag/AllowanceResourceControl.svelte';
	import Portrait from '../frag/Portrait.svelte';
	import TokenRow from '../frag/TokenRow.svelte';
	import Row from '../ui/Row.svelte';
	
	

	// get page from context
	const k_page = getContext<Page>('page');

	// dict of balances for both native assets and fungible tokens
	let h_balances: Dict<Promise<BigNumber>> = {};

	// dict of fiat equivalents 
	let h_fiats: Dict<Promise<BigNumber>> = {};

	// account's total worth in selected fiat
	let dp_total: Promisable<string> = forever('');

	// when the chain changes
	let p_best_faucet = '';

	// list of coin ids that are empty and normally used as gas tokens
	let a_no_gas: string[] = [];

	// track which tokens have outgoing txs pending
	let h_pending_txs: Dict<JsonObject> = {};

	// keep list of testnet tokens for batch minting
	let a_mintable: ContractStruct[] = [];

	// determine best faucet upon chain switch
	$: if($yw_chain.testnet?.faucets?.length) {
		// reset faucet to default
		p_best_faucet = $yw_chain.testnet.faucets[0];

		// attempt to find best faucet
		void best_faucet().then(p => p_best_faucet = p);
	}

	// let g_account_cached: AccountStruct;
	// $: if($yw_account && $yw_account !== g_account_cached) {
	// 	g_account_cached = $yw_account;
	// 	h_fiats = {};
	// }

	// whenever the fiats dict is updated, begin awaiting for all to resolve
	$: if(h_fiats) {
		void navigator.locks.request('ui:holdings:total-balance', () => timeout_exec(30e3, async() => {
			// resolve all fiat promises
			const a_fiats = await Promise.all(ode(h_fiats).map(([, dp_fiat]) => dp_fiat));

			// no fiats yet; wait for some to populate
			if(!a_fiats.length) return;

			// reduce to sum
			const yg_total = a_fiats.reduce((yg_sum, yg_balance) => yg_sum.plus(yg_balance), BigNumber(0));

			// format to string and resolve
			const s_total = dp_total = format_fiat(yg_total.toNumber(), 'usd');

			// save to cache if different
			if(s_total !== $yw_account.extra?.total_fiat_cache) {
				void Accounts.update($yw_account_ref, g_account => ({
					extra: {
						...g_account.extra,
						total_fiat_cache: dp_total,
					},
				}));
			}
		}));
	}

	// save previous chain in order to detect actual changes
	let g_chain_cached = $yw_chain;
	$: {
		// chain was changed
		if($yw_chain !== g_chain_cached) {
			// update cache
			g_chain_cached = $yw_chain;

			// reset no-gas tracker
			a_no_gas = [];
		}
	}

	let c_updates = 0;
	let i_update = 0;
	{
		subscribe_store(['chains', 'contracts', 'incidents'], () => {
			console.info(`BalancesHome.svelte observed store update; reloading...`);

			// debounce
			if(!i_update) {
				i_update = window.setTimeout(() => {
					i_update = 0;

					// trigger UI update
					c_updates++;
				}, 500);
			}

			// reload net worth
			// calculate_net_worth();
		}, onDestroy);

		// react to page visibility changes
		yw_doc_visibility.subscribe((s_state) => {
			if('visible' === s_state) {
				c_updates += 1;
			}
		});

		// react to switch changes
		yw_account.subscribe(() => c_updates++);
		yw_chain.subscribe(() => c_updates++);
		yw_network.subscribe(() => c_updates++);

		const f_unregister = global_receive({
			transferReceive() {

			},

			tokenAdded: () => c_updates++,
		});

		onDestroy(() => {
			f_unregister();
		});
	}


	// fetch all bank balances for current account
	async function load_native_balances() {
		// reset locals
		h_balances = {};
		h_fiats = {};
		dp_total = forever('');

		// attempt to load all bank balances from network
		let h_balances_native: Dict<BalanceBundle>;
		try {
			h_balances_native = await $yw_network.bankBalances($yw_owner);
		}
		// network error
		catch(e_network) {
			// orderly error
			if(e_network instanceof Error) {
				// provider offline
				if(e_network.message.includes('Response closed without headers')) {
					// ref provider struct
					const g_provider = $yw_network.provider;

					syserr({
						title: 'Network Error',
						text: `Your network provider "${g_provider.name}" is offline: <${g_provider.grpcWebUrl}>`,
					});
				}
				// other network error
				else {
					syserr({
						title: 'Network Error',
						error: e_network,
					});
				}
			}
			// other
			else {
				syserr({
					title: 'Unknown Error',
					text: e_network+'',
				});
			}

			// no balances available
			return [];
		}

		// prep output
		const a_outs: [string, CoinInfo, Coin][] = [];

		// reset no-gas tracker
		a_no_gas.length = 0;

		const a_no_gas_tmp: string[] = [];

		// each coin returned in balances
		for(const [si_coin, g_coin] of ode($yw_chain.coins)) {
			const g_bundle = h_balances_native[si_coin];

			// parse balance
			const yg_balance = BigNumber(g_bundle?.balance.amount || '0');

			// save to dict
			h_balances[si_coin] = Promise.resolve(yg_balance);

			// missing or zero balance
			if(yg_balance.eq(0)) {
				// coin is a gas token
				if(Chains.allFeeCoins($yw_chain).find(([si]) => si === si_coin)) {
					a_no_gas_tmp.push(si_coin);
				}

				// set balance (no need to fetch worth of coin)
				h_fiats[si_coin] = Promise.resolve(BigNumber(0));
			}
			// non-zero balance
			else {
				// asynchronously convert to fiat
				h_fiats[si_coin] = coin_to_fiat(g_bundle.balance, $yw_chain.coins[si_coin]);
			}

			// add to outputs
			a_outs.push([
				si_coin,
				$yw_chain.coins[si_coin],
				g_bundle?.balance || {amount:'0', denom:g_coin.denom},
			]);
		}

		// trigger update on balances and fiats dicts
		h_balances = h_balances;
		h_fiats = h_fiats;

		try {
			await check_fee_grants(a_no_gas_tmp);
		}
		catch(e_query) {}

		// update gas
		a_no_gas = a_no_gas_tmp;

		return a_outs;
	}


	let k_fee_grants: FeeGrants | undefined;

	let a_gas_grants: string[] = [];
	let s_grant_status = 'Loading allowances...';
	let s_grant_summary = '';

	async function check_fee_grants(a_tmp: string[]) {
		k_fee_grants = await FeeGrants.forAccount($yw_account, $yw_network);

		// clear list from previous load
		a_gas_grants.length = 0;

		const h_grants = k_fee_grants.grants;

		const a_grant_coins: string[] = [];

		// each gas coin
		for(const [si_coin] of Chains.allFeeCoins($yw_chain)) {
			const g_grant = h_grants[si_coin];

			// non-zero grant amount
			if(g_grant?.amount.gt(0)) {
				// remove coin from no gas list
				if(a_tmp.includes(si_coin)) remove(a_tmp, si_coin);

				const a_granters = ode(g_grant.granters);
				let s_granters = 'multiple parties';
				if(1 === a_granters.length) {
					s_granters = await address_to_name(a_granters[0][0], $yw_chain);
					s_granters = s_granters.replace(/fee-?grant|faucet$/gi, '').trim();
				}

				// 
				// a_gas_grants.push(`Able to spend ${format_amount(g_grant.amount.toNumber())} ${si_coin} (${s_granters})`);
				a_gas_grants.push(`Fees granted by ${s_granters}: ${format_amount(g_grant.amount.toNumber())} ${si_coin}`);
				a_grant_coins.push(si_coin);
			}
		}

		// single coin allowance
		if(1 === a_gas_grants.length) {
			s_grant_status = '';
			s_grant_summary = a_gas_grants[0];
		}
		// multiple coins
		else if(a_gas_grants.length > 1) {
			s_grant_status = '';
			s_grant_summary = `Able to spend allowances for ${a_grant_coins.join(', ')}`;
		}
		// no allowances
		else {
			s_grant_status = 'No allowances granted to this account';
		}

		// reactive assign
		a_gas_grants = a_gas_grants;
	}

	// load all token defs from store belonging to current account
	async function load_tokens() {
		// reset pending txs
		h_pending_txs = {};

		// reset mintable tokens
		a_mintable = [];

		// reset fiats
		h_fiats = {};

		// 
		const g_assets = $yw_account?.assets?.[$yw_chain_ref];
		if(!g_assets) return [];

		const a_bech32s = g_assets.fungibleTokens;

		const a_contract_paths = a_bech32s.map(sa => Contracts.pathFor($yw_chain_ref, sa));

		const ks_contracts = await Contracts.read();
		const a_tokens = a_contract_paths.map(p => ks_contracts.at(p)!);

		// load incidents
		const a_pending = await Incidents.filter({
			type: 'tx_out',
			stage: 'pending',
		});

		// each pending outgoing tx
		for(const g_pending of a_pending) {
			// ref events
			const h_events = (g_pending.data as TxPending).events;

			// each indexed execution event; associate by contract address
			for(const g_exec of h_events.executions || []) {
				h_pending_txs[g_exec.contract] = g_exec.msg;
			}
		}

		// update pending txs
		h_pending_txs = h_pending_txs;

		return a_tokens;
	}

	// fetch an individual token's current balance
	async function load_token_balance(g_contract: ContractStruct) {
		// ref token address
		const sa_token = g_contract.bech32;

		// indicate that token fiat is loading
		let fk_fiat: (yg_fiat: BigNumber) => void;
		h_fiats[sa_token] = new Promise(fk => fk_fiat = fk);

		// let other tokens create dict entry, then trigger reactive update to fiats dict
		await microtask();
		h_fiats = h_fiats;

		// load token balance
		const g_balance = await token_balance(g_contract, $yw_account, $yw_network);

		if(g_balance) {
			// set fiat promise
			void g_balance.yg_fiat.then(yg => fk_fiat(yg));

			if(g_balance.yg_amount.eq(0)) {
				// determine if it is mintable
				const k_token = Snip2xToken.from(g_contract, $yw_network as SecretNetwork, $yw_account);
				void k_token?.mintable().then((b_mintable) => {
					if(b_mintable && !a_mintable.find(g => g.bech32 === g_contract.bech32)) {
						a_mintable = a_mintable.concat([g_contract]);
					}
				});
			}

			return g_balance;
		}
		// no balance; load forever
		else {
			fk_fiat!(BigNumber(0));
		}

		return null;
	}

	async function mint_tokens() {
		if($yw_chain.features.secretwasm) {
			// ref chain
			const g_chain = $yw_chain;

			// mint message
			const a_msgs_proto = await Promise.all(a_mintable.map(async(g_contract) => {
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

	// perform tests to deduce best faucet based on availability
	async function best_faucet(): Promise<string> {
		const a_faucets = $yw_chain.testnet!.faucets!;

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

			// return first valid response
			return d_res.url;
		}
		// ignore network errors and timeouts
		catch(e) {}

		// default to original
		return a_faucets[0];
	}

	let b_requesting_feegrant = false;
	async function request_feegrant() {
		b_requesting_feegrant = true;

		const f_cancel_progress_req = make_progress_timer({
			estimate: 2e3,
			range: [0, 25],
		});

		try {
			await fetch('https://faucet.secretsaturn.net/claim', {
				method: 'POST',
				headers: {
					'accept': 'application/json, text/plain, */*',
					'content-type': 'application/json;charset=UTF-8',
				},
				body: JSON.stringify({
					address: $yw_owner,
				}),
				mode: 'cors',
			});
		}
		catch(e_fetch) {
			b_requesting_feegrant = false;
			return;
		}
		finally {
			f_cancel_progress_req();
		}

		const f_cancel_chain = make_progress_timer({
			estimate: 6e3,
			range: [25, 90],
		});

		// listen for fee grant
		// global_receive({
		// 	''
		// });

		b_requesting_feegrant = false;
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

	.grant-status {
		color: var(--theme-color-text-med);
	}
</style>

<Screen debug='BalancesHome' nav root keyed>
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

		<!-- {#key $yw_chain} -->
			{#if !a_gas_grants.length && a_no_gas.length}
				<div class="no-gas text-align_center subinfo">
					<div class="message">
						<span class="warning">Warning:</span> you don't have any {$yw_chain.testnet? 'testnet ':''}{a_no_gas.join(' or ')} to pay gas fees.
					</div>

					<div class="buttons">
						<!-- chain is testnet, link to faucet -->
						{#if $yw_chain.testnet}
							<button class="pill" on:click={() => open_external_link(p_best_faucet)}>Get {a_no_gas.join(' or ')} from faucet</button>
						{:else if $yw_chain.mainnet?.feegrants?.length}
							<button class="pill" on:click={() => request_feegrant()} disabled={b_requesting_feegrant}>
								{#if b_requesting_feegrant}
									Requesting allowance...
								{:else}
									Request fee allowance
								{/if}
							</button>
						{:else}
							<button class="pill">
								Buy {a_no_gas.join(' or ')}
							</button>
						{/if}
					</div>
				</div>
			{:else if a_mintable.length > 1}
				<div class="zero-balance-tokens text-align_center subinfo">
					<div class="message">
						Want to mint all of your testnet tokens?
					</div>

					<div class="buttons">
						<button class="pill" on:click={() => mint_tokens()}>
							Mint {a_mintable.length} tokens.
						</button>
					</div>
				</div>
			{/if}

			<!-- <div class="owner-address subinfo">
				<Address address={$yw_owner} copyable='icon' />
			</div> -->

			<div class="group" style="margin-bottom:-12px;">
				<AddressResourceControl address={$yw_owner} />


				<AllowanceResourceControl>
					{#if s_grant_status}
						<span class="grant-status">
							{s_grant_status}
						</span>
					{:else}
						{s_grant_summary}
					{/if}
				</AllowanceResourceControl>
			</div>

		<!-- {/key} -->
		
		<!-- {#key $yw_network || $yw_owner} -->
			<div class="rows no-margin border-top_black-8px">
				<!-- fetch native coin balances, display known properties while loading -->
				{#await load_native_balances()}
					<!-- each known coin -->
					{#each ode($yw_chain.coins) as [si_coin, g_bundle]}
						<!-- cache holding path -->
						{@const p_entity = Entities.holdingPathFor($yw_owner, si_coin)}
						<Row lockIcon detail='Native Coin' postnameTags
							resourcePath={p_entity}
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
				<!-- all bank balances loaded -->
				{:then a_balances}
					<!-- each coin -->
					{#each a_balances as [si_coin, g_coin, g_balance]}
						<!-- cache holding path -->
						{@const p_entity = Entities.holdingPathFor($yw_owner, si_coin)}
						<Row lockIcon detail='Native Coin' postnameTags
							resourcePath={p_entity}
							name={si_coin}
							pfp={$yw_chain.pfp}
							amount={as_amount(g_balance, g_coin)}
							fiat={h_fiats[si_coin].then(yg => format_fiat(yg.toNumber(), 'usd'))}
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

				<!-- fetch fungible token defs -->
				{#await load_tokens()}
					<Row
						name={forever('')}
						amount={forever('')}
					/>
				{:then a_tokens}
					<!-- each token -->
					{#each a_tokens as g_token}
						<!-- fetch token balance from contract state -->
						{#await load_token_balance(g_token)}
							<TokenRow contract={g_token} balance />
						<!-- balance loaded -->
						{:then g_balance}
							<!-- outgoing tx pending on contract -->
							{#if h_pending_txs[g_token.bech32]}
								<TokenRow contract={g_token} pending balance />
							<!-- fully synced with chain -->
							{:else if g_balance}
								<TokenRow contract={g_token} balance={g_balance}
									mintable={!!a_mintable.find(g => g.bech32 === g_token.bech32)}
								/>
							<!-- unable to view balance -->
							{:else}
								<TokenRow contract={g_token} unauthorized />
							{/if}
						<!-- failed to fetch balance -->
						{:catch e_load}
							<!-- viewing key error -->
							{#if e_load instanceof ViewingKeyError}
								<TokenRow contract={g_token} error={'Viewing Key Error'} on:click_error={() => {
									k_page.push({
										creator: TokensAdd,
										props: {
											suggested: [g_token],
										},
									});
								}} />
							<!-- unknown error -->
							{:else}
								<TokenRow contract={g_token} error={(e_load.name || e_load.message || 'Error')+''} />
							{/if}
						{/await}
					{/each}
				{/await}
			</div>
		<!-- {/key} -->
	{/key}
</Screen>
