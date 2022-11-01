<script context="module" lang="ts">

	export type SignaturePreset = '' | 'snip24' | 'snip20ViewingKey'
	| 'wasm/MsgExecuteContract' | 'wasm/MsgInstantiateContract';

	export interface CompletedProtoSignature {
		proto: SignedDoc;
	}

	export interface CompletedAminoSignature extends JsonObject {
		amino: AdaptedAminoResponse;
	}

	export type CompletedSignature = CompletedAminoSignature | CompletedProtoSignature;

</script>

<script lang="ts">
	import type {Coin} from '@cosmjs/amino';
	
	import type {AccountStruct} from '#/meta/account';
	import type {Dict, JsonObject, Promisable} from '#/meta/belt';
	import type {Bech32, CoinInfo, FeeConfig, FeeConfigAmount, FeeConfigPriced} from '#/meta/chain';
	import type {Cw} from '#/meta/cosm-wasm';
	import type {MsgEventRegistry, TxMsg, TxPending} from '#/meta/incident';
	import type {AdaptedAminoResponse, AdaptedStdSignDoc, GenericAminoMessage} from '#/schema/amino';
	import type {Snip24PermitMsg} from '#/schema/snip-24-def';
	
	import {TxBody} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
	import BigNumber from 'bignumber.js';
	import {slide} from 'svelte/transition';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {JsonPreviewer} from '../helper/json-previewer';
	import {yw_network, yw_progress} from '../mem';
	
	import {type LoadedAppContext, load_app_context} from '#/app/svelte';
	import {Coins} from '#/chain/coin';
	import {type ProtoMsg, proto_to_amino, encode_proto} from '#/chain/cosmos-msgs';
	import type {DescribedMessage} from '#/chain/messages/_types';
	import {H_INTERPRETTERS} from '#/chain/msg-interpreters';
	import type {SecretNetwork} from '#/chain/secret-network';
	import {signAmino, type SignedDoc} from '#/chain/signing';
	import {pubkey_to_bech32} from '#/crypto/bech32';
	import SensitiveBytes from '#/crypto/sensitive-bytes';
	import {global_broadcast, global_receive} from '#/script/msg-global';
	import {Accounts} from '#/store/accounts';
	import {Apps, G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Incidents} from '#/store/incidents';
	import {forever, is_dict, ode, proper, timeout} from '#/util/belt';
	import {buffer_to_base64, buffer_to_base93} from '#/util/data';
	import {format_fiat} from '#/util/format';
	
	import FatalError from './FatalError.svelte';
	import SigningData from './SigningData.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import AppBanner from '../ui/AppBanner.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Field from '../ui/Field.svelte';
	import Fields from '../ui/Fields.svelte';
	import Gap from '../ui/Gap.svelte';
	import Load from '../ui/Load.svelte';
	import Row from '../ui/Row.svelte';
	import type {SelectOption} from '../ui/StarSelect.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	
	const g_context = load_app_context<CompletedSignature | null>();
	const {
		g_app,
		p_app,
		g_chain,
		p_account,
		completed,
		k_page,
	} = g_context;

	// chain should always be present
	const p_chain = Chains.pathFrom(g_chain);

	const dp_account = Accounts.at(p_account) as Promise<AccountStruct>;

	/**
	 * Will be set if SIGN_MODE_LEGACY_AMINO_JSON is being used
	 */
	export let amino: AdaptedStdSignDoc | null = null;
	const g_amino = amino;

	export let protoMsgs: ProtoMsg[];
	const a_proto_msgs = protoMsgs;

	export let fee: FeeConfig;
	const gc_fee = fee;

	export let broadcast: {} | null = null;

	export let local = false;
	

	// get fee coin from chain
	const [si_coin, g_info] = Chains.feeCoin(g_chain);

	let s_gas_limit = '0';
	let s_gas_price = '0';

	let g_fee_coin_info: CoinInfo;

	let s_fee_total = '0';
	let s_fee_total_display = '0';
	let dp_fee_fiat: Promise<string> = forever();

	export let contractAddress: Bech32 | null = null;
	export const sa_wasm = contractAddress;

	export let executeMessage: JsonObject | null = null;
	const h_wasm_exec = executeMessage;
	
	const h_secret_wasm_exec: JsonObject | null = null;

	let s_title = 'Sign Transaction';
	let s_tooltip = '';

	const a_viewing_key_items: SelectOption[] = [];

	/**
	 * Set to true once the document has completely loaded
	 */
	let b_loaded = false;

	const H_PRESETS: Dict<(g_value: JsonObject) => Promisable<DescribedMessage>> = {
		'query_permit'(g_permit: Snip24PermitMsg['value']) {
			return {
				title: 'Sign Query Permit',
				tooltip: 'Allows apps to view private data such as your token balance, ownership, etc. Scope and permissions are unique to each permit.',
				fields: [
					{
						type: 'key_value',
						key: 'Permissions',
						value: g_permit.permissions.map(proper).join(', '),
					},
					{
						type: 'key_value',
						key: 'Permit name',
						value: g_permit.permit_name,
					},
					{
						type: 'contracts',
						label: 'Tokens allowed to be queried',
						bech32s: g_permit.allowed_tokens,
						g_app,
						g_chain,
					},
				],
			} as DescribedMessage;
		},

		// snip20ViewingKey() {
		// 	a_viewing_key_items = [
		// 		{
		// 			value: '',
		// 			primary: 'Create new viewing key',
		// 		},
		// 	];

		// 	return {
		// 		title: 'Add Viewing Key',
		// 		tooltip: `Creates a single, revokable key for this specific token that allows anyone with access to view private data such as your token's balance, history, etc.`,
		// 		fields: [
		// 			{
		// 				type: 'contracts',
		// 				label: 'Token allowed to be queried',
		// 				bech32s: [contractAddress!],
		// 			},
		// 		],
		// 	};
		// },

	};

	const S_WARN_TRICK = 'This is an unusual message and might have been designed to trick you.';

	type Lint = {
		warn: string;
		fix: () => Promisable<void>;
	} | {
		error: string;
	};

	function autopad() {
		if(!is_dict(h_wasm_exec)) return;

		const g_main = h_wasm_exec[Object.keys(h_wasm_exec)[0]];

		if(!is_dict(g_main)) return;

		// start with empty padding
		g_main.padding = '';

		// estimate output message length
		const nl_msg = JSON.stringify(h_wasm_exec).length;

		// bump up to next 256-byte interval
		const nl_gap = Math.ceil(nl_msg / 256) * 256;

		// fill with noise
		g_main.padding = buffer_to_base64(SensitiveBytes.random(nl_gap >> 1).data);

		// make up for odd byte
		if(nl_gap % 2) g_main.padding += '0';
	}

	let a_lint: Lint[] = [];
	let s_warn = '';
	function validate_or_warn(h_msg: JsonObject) {
		const a_keys = Object.keys(h_msg);

		if(1 !== a_keys.length) {
			s_warn = S_WARN_TRICK;
			return;
		}

		const a_lint_local = [];

		const si_root = a_keys[0];

		const z_value = h_msg[si_root];

		if(!is_dict(z_value)) {
			s_warn = S_WARN_TRICK;
			return;
		}

		const g_value: JsonObject = z_value;

		switch(si_root) {
			case 'set_viewing_key': {
				function generate_viewing_key() {
					const atu8_entropy = SensitiveBytes.random(32).data;
					g_value.key = `🔑${buffer_to_base93(atu8_entropy)}`;
					validate_or_warn(h_msg);
				}

				delete g_value.padding;

				// if non-empty, then App provided message
				if(g_value.key) {
					// suggest a fix to user
					a_lint_local.push({
						warn: `App is suggesting the viewing key's password, which is highly unusual. `,
						fix: generate_viewing_key,
					});
				}
				// generate viewing key automatically
				else {
					generate_viewing_key();
				}

				// anything else is suspect
				const as_keys = new Set(Object.keys(g_value));
				as_keys.delete('key');
				as_keys.delete('padding');
				if(as_keys.size) {
					a_lint_local.push({
						warn: `App included non-standard properties with viewing key creation.`,
						fix() {
							for(const si_key in g_value) {
								if(!['key', 'padding'].includes(si_key)) {
									delete g_value[si_key];
								}
							}
						},
					});
				}

				break;
			}

			default: {
				// 
			}
		}

		a_lint = a_lint_local;
	}

	let a_overviews: DescribedMessage[] = [];


	async function describe_message(g_msg): Promise<DescribedMessage> {
		const si_amino = g_msg.type;

		const g_account = await dp_account;

		if(!g_account) {
			throw new Error('Account does not exist?!');
		}

		const g_loaded = {
			...g_context,
			g_account,
		} as LoadedAppContext;

		if(si_amino in H_INTERPRETTERS) {
			const g_interpretted = await H_INTERPRETTERS[si_amino](g_msg.value as JsonObject, g_loaded);

			return await g_interpretted.describe();
		}

		// fallback to rendering amino message directly
		return {
			title: si_amino,
			fields: [
				JsonPreviewer.render(g_msg.value as JsonObject, {
					chain: g_chain,
				}, {
					title: 'Arguments',
				}),
			],
		};
	}

	(async() => {
		// try setting to amino if defined by default
		let a_msgs = amino?.msgs;

		// proto
		if(a_proto_msgs?.length) {
			// convert to amino
			a_msgs = a_proto_msgs.map(g => proto_to_amino(g, g_chain.bech32s.acc));
		}

		// messages are defined
		if(a_msgs?.length) {
			// single message
			if(1 === a_msgs.length) {
				// ref message
				const {
					type: si_amino,
					value: g_value,
				} = a_msgs[0];

				// interpret message
				const g_overview = H_PRESETS[si_amino]
					? await H_PRESETS[si_amino](g_value)
					: await describe_message(a_msgs[0]);

				// lift properties from overview
				s_title = g_overview.title;
				s_tooltip = g_overview.tooltip || '';

				// assign
				a_overviews = [g_overview];
			}
			// multiple messages
			else {
				s_title = 'Sign Multi-Message Transaction';
				s_tooltip = 'Submits multiple messages to the chain to be processed in the same block.';

				a_overviews = await Promise.all(a_msgs.map(describe_message));
			}
		}

		// else if(h_wasm_exec) {
		// 	// check for well-known keys
		// 	if('set_viewing_key' in h_wasm_exec) {
		// 		validate_or_warn(h_wasm_exec);
		// 	}
		// }

		b_loaded = true;
	})();

	function view_data() {
		if(amino) {
			k_page.push({
				creator: SigningData,
				props: {
					amino,
					wasm: h_secret_wasm_exec,
				},
			});
		}
	}

	async function approve() {
		const g_account = await dp_account;

		if(!g_account) {
			throw new Error('Account does not exist?!');
		}

		// prep signed transaction hash
		let si_txn = '';

		const sa_sender = pubkey_to_bech32(g_account.pubkey, g_chain.bech32s.acc);

		let a_equivalent_amino_msgs!: GenericAminoMessage[];

		let g_completed!: CompletedSignature;

		// amino
		if(g_amino) {
			a_equivalent_amino_msgs = g_amino.msgs;

			// attempt to sign
			try {
				// sign amino
				const g_signature = await signAmino(g_account, g_amino);

				// set completed data
				g_completed = {
					amino: {
						signed: g_amino,
						signature: g_signature,
					},
				};

				// TODO: finalize amino doc


				// // produce transaction bytes and hash
				// const {
				// 	sxb16_hash,
				// } = $yw_network.finalizeTxRaw({
				// 	body: g_signed.doc.bodyBytes,
				// 	auth: g_signed.doc.authInfoBytes,
				// 	signature: ,
				// });

				

			}
			// signing error
			catch(e_sign) {
				k_page.push({
					creator: FatalError,
					props: {
						text: `While attempting to sign an Amino document: ${e_sign.stack}`,
					},
				});

				// do not complete
				return;
			}
		}
		// proto
		else if(a_proto_msgs?.length) {
			// attempt to sign
			try {
				// encode tx body
				const atu8_body = encode_proto(TxBody, {
					messages: a_proto_msgs,
				});

				// sign direct
				const g_signed = await $yw_network.signDirect(g_account, g_chain, atu8_body, {
					gasLimit: s_gas_limit,
					amount: [{
						denom: g_fee_coin_info.denom,
						amount: s_fee_total,
					}],
					payer: '',
					granter: '',
				});

				// set completed data
				g_completed = {
					proto: g_signed,
				};

				// produce transaction bytes and hash
				const {
					sxb16_hash,
				} = $yw_network.finalizeTxRaw({
					body: g_signed.doc.bodyBytes,
					auth: g_signed.doc.authInfoBytes,
					signature: g_signed.signature,
				});

				// set transaction id
				si_txn = sxb16_hash.toUpperCase();

				// produce equivalent amino messages
				a_equivalent_amino_msgs = a_proto_msgs.map(g_proto => proto_to_amino(g_proto, g_chain.bech32s.acc));
			}
			// signing error
			catch(e_sign) {
				debugger;

				k_page.push({
					creator: FatalError,
					props: {
						message: `While attempting to sign a direct protobuf transaction: ${e_sign.stack}`,
					},
				});

				// do not complete
				return;
			}
		}


		// prep context
		const g_loaded = {
			...g_context,
			g_account,
		} as LoadedAppContext;

		// prep events
		const h_events: Partial<MsgEventRegistry> = {};

		// interpret messages
		for(const g_msg of a_equivalent_amino_msgs) {
			const si_amino = g_msg.type;

			// interpretter exists for this message type
			if(si_amino in H_INTERPRETTERS) {
				// interpret
				const g_interpretted = await H_INTERPRETTERS[si_amino](g_msg.value as JsonObject, g_loaded);

				// approve
				const h_merge = await g_interpretted.approve?.(si_txn);

				// merge events
				if(h_merge) {
					for(const [si_event, a_events] of ode(h_merge)) {
						if(a_events) {
							// @ts-expect-error until better typings
							(h_events[si_event] = h_events[si_event] || []).push(...a_events);
						}
					}
				}
			}
		}

		// transaction will be broadcast
		if(si_txn) {
			// record outgoing tx
			await Incidents.record({
				type: 'tx_out',
				id: si_txn,
				data: {
					stage: 'pending',
					app: p_app,
					chain: Chains.pathFrom(g_chain),
					account: p_account,
					code: 0,
					hash: si_txn,
					raw_log: '',
					gas_limit: s_gas_limit as Cw.Uint128,
					gas_wanted: '' as Cw.Uint128,
					gas_used: '' as Cw.Uint128,
					events: h_events,
				} as TxPending,
			});

			// set progress
			$yw_progress = [20, 100];

			// clear progress bar after short timeout
			async function clear_progress() {
				f_unbind();
				await timeout(1.5e3);
				$yw_progress = [0, 0];
			}

			// listen for global tx events
			const f_unbind = global_receive({
				txError() {
					$yw_progress = [1, 100];
					void clear_progress();
				},

				txSuccess() {
					$yw_progress = [100, 100];
					void clear_progress();
				},
			});

			// set interval to update it
			let n_progress = 20;
			const n_increment = 5;
			const i_interval = setInterval(() => {
				// still waiting
				if(![0, 1, 100].includes($yw_progress[0])) {
					n_progress += n_increment;
					$yw_progress = [n_progress, 100];

					// keep updating until reaching 80% progress
					if(n_progress < 80) return;
				}

				clearInterval(i_interval);
			}, 500);

			// ensure service is alive
			global_broadcast({
				type: 'heartbeat',
			});
		}
		// was just for signing
		else {
			// TODO: save signed_json incident

			// record incident
			await Incidents.record({
				type: 'signed_json',
				data: {
					app: Apps.pathFrom(g_app),
					account: p_account,
					events: h_events,
				},
			});
		}

		// dispatch update
		global_broadcast({
			type: 'reload',
		});

		if(g_completed) {
			if(broadcast) {
				const g_proto = (g_completed as CompletedProtoSignature).proto;
				if(g_proto) {
					// broadcast transaction
					await $yw_network.broadcastDirect({
						body: g_proto.doc.bodyBytes,
						auth: g_proto.doc.authInfoBytes,
						signature: g_proto.signature,
					});
				}
				else {
					throw syserr({
						title: 'Amino broadcasting not yet implemented',
						text: 'At this screen only',
					});
				}
			}

			completed?.(true, g_completed);
		}

		// local; reset navigator thread
		if(local) {
			k_page.reset();
		}
	}

	$: {
		// compute total gas fee
		const yg_fee = BigNumber(s_gas_price).times(s_gas_limit);

		// convert to integer string
		s_fee_total = yg_fee.integerValue(BigNumber.ROUND_CEIL).toString();

		if(g_fee_coin_info) {
			const g_coin = {
				amount: s_fee_total,
				denom: g_fee_coin_info.denom,
			};

			s_fee_total_display = Coins.summarizeAmount(g_coin, g_chain);

			dp_fee_fiat = Coins.displayInfo(g_coin, g_chain).then(g_display => `=${format_fiat(g_display.fiat, g_display.versus)}`);
		}
	}

	// parse network fee
	{
		// get fee coin from chain
		[, g_fee_coin_info] = Chains.feeCoin(g_chain);

			// a_amounts = [
			// 	{
			// 		denom: g_chain.feeCoin,
			// 		amount: BigNumber(gc_fee_price.price).times(BigNumber(String(gc_fee_price.limit)))
			// 			.integerValue(BigNumber.ROUND_CEIL).toString(),
			// 	},
			// ];

			// const a_fees = a_amounts.map(g_amount => Chains.summarizeAmount(g_amount, g_chain));
	
		// prep fee amounts
		let a_amounts: Coin[] = [];

		// start with the default gas price
		let yg_price_suggest = BigNumber(g_chain.gasPrices.default);

		// as amino doc
		if(amino) {
			// inherit gas limit from doc
			s_gas_limit = amino.fee.gas;

			// ref amounts
			a_amounts = amino.fee.amount;
		}
		// as proto doc
		else {
			// inherit gas limit from config
			s_gas_limit = String(gc_fee.limit);

			// amounts provided
			if(gc_fee?.['amount']) {
				a_amounts = (gc_fee as FeeConfigAmount).amount;
			}
			// price provided
			else if(gc_fee?.['price']) {
				// override suggest price
				yg_price_suggest = BigNumber(String((gc_fee as FeeConfigPriced).price));
			}
		}

		// app provided gas amounts
		if(a_amounts?.length) {
			// collect prices from app
			const h_prices_app: Dict<BigNumber> = {};

			// each amount provided by app
			for(const g_coin of a_amounts) {
				if('0' !== g_coin.amount) {
					// convert to price
					h_prices_app[g_coin.denom] = BigNumber(g_coin.amount).dividedBy(s_gas_limit);
				}
			}

			// a price was provided for intended coin; override suggested price
			const yg_price = h_prices_app[g_fee_coin_info.denom];
			if(yg_price) {
				yg_price_suggest = yg_price;
			}
		}

		// set gas price
		s_gas_price = yg_price_suggest.toString();
	}

	function estimate_gas(): {
		id: string;
		info: CoinInfo;
		amount: string;
		coin: Coin;
	} {
		if(amino) {
			// destructure fee
			const {
				gas: s_gas_limit_doc,
				amount: a_amounts,
			} = amino.fee;

			// inherit gas limit from doc
			s_gas_limit = s_gas_limit_doc;

			// start with the default gas price
			let yg_price_suggest = BigNumber(g_chain.gasPrices.default);

			// app provided gas amounts
			if(a_amounts?.length) {
				// collect prices from app
				const h_prices_app: Dict<BigNumber> = {};

				// each amount provided by app
				for(const g_coin of a_amounts) {
					if('0' !== g_coin.amount) {
						// convert to price
						h_prices_app[g_coin.denom] = BigNumber(g_coin.amount).dividedBy(s_gas_limit);
					}
				}

				// a price was provided for intended coin; override suggested price
				const yg_price = h_prices_app[g_info.denom];
				if(yg_price) {
					yg_price_suggest = yg_price;
				}
			}

			// set gas price
			s_gas_price = yg_price_suggest.toString();

			g_fee_coin_info = g_info;

			// // compute total gas fee
			// const yg_fee = yg_price_suggest.times(s_gas_limit);

			// // convert to integer string
			// const sn_amount = yg_fee.integerValue(BigNumber.ROUND_CEIL).toString();

			// return {
			// 	id: si_coin,
			// 	info: g_info,
			// 	amount: sn_amount,
			// 	coin: {
			// 		denom: g_info.denom,
			// 		amount: sn_amount,
			// 	},
			// };

			// debugger;
			// // attempt to simulate the tx
			// {
			// 	const g_account = await dp_account;

			// 	await $yw_network.simulate(g_account, {
			// 		messages: amino.msgs.map(g => amino_to_base(g).encode()),
			// 		memo: amino.memo,
			// 	}, {
			// 		signerInfos: [{
			// 			sequence: '0',
			// 		}],
			// 	});
			// }
		}
		else {
			throw new Error('Not yet implemented');
		}
	}

	let b_tooltip_showing = false;

	async function count_existing_contracts(si_code: string) {
		return await ($yw_network as SecretNetwork).contractsByCode(si_code as `${bigint}`);
	}

	let b_show_fee_adjuster = false;
	let s_adjust_fee_text = 'Adjust fee';

	let a_original_gas_settings: string[];

	function click_adjust_fee() {
		// first time clicking
		if(!b_show_fee_adjuster) {
			a_original_gas_settings = [s_gas_limit, s_gas_price];
			b_show_fee_adjuster = true;
			s_adjust_fee_text = 'Reset fee';
		}
		// user is resetting gas settings
		else {
			b_show_fee_adjuster = false;
			s_adjust_fee_text = 'Adjust fee';
			[s_gas_limit, s_gas_price] = a_original_gas_settings;
		}
	}

	function cancel() {
		if(local) {
			k_page.pop();
		}
	
		completed?.(false);
	}
</script>

<style lang="less">
	@import './_base.less';

	.overview {
		position: relative;
		margin-top: 2px !important;

		>.actions {
			position: absolute;
			top: 0;
			right: 0;
			margin-top: -4px;
		}

		>.fields {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: var(--gap, var(--ui-padding));
		}
	}
</style>

<Screen>
	{#await dp_account}
		<AppBanner app={g_app} chain={g_chain} on:close={() => cancel()}>
			<span slot="default" style="display:contents;">
				{s_title}
			</span>
			<span slot="context" style="display:contents;">
				[...]
			</span>
		</AppBanner>
	{:then g_account}
		<AppBanner app={g_app} chain={g_chain} account={g_account} on:close={() => cancel()}>
			<span slot="default" style="display:contents;">
				<!-- let the title appear with the tooltip -->
				<span style="position:relative; z-index:16;">
					{s_title}
				</span>
				{#if s_tooltip}
					<Tooltip bind:showing={b_tooltip_showing}>
						{s_tooltip}
					</Tooltip>
				{/if}
			</span>
			<span slot="context" style="display:contents;">
				{g_account?.name || ''}
			</span>
		</AppBanner>
	{/await}

	{#each a_overviews as g_overview, i_overview}
		{#if a_overviews.length > 1}
			<Gap />
			<h3>{i_overview+1}. {g_overview.title}</h3>
		{:else}
			<hr>
		{/if}

		<div class="overview">
			<div class="actions">
				<button class="pill" on:click={() => view_data()}>
					View Data
				</button>
			</div>

			<div class="fields">
				<!-- special rules -->
				<!-- {#if 'snip20ViewingKey' === si_preset}
					<StarSelect showIndicator items={a_viewing_key_items} disabled={a_viewing_key_items.length < 2}>

					</StarSelect>
				{/if} -->

				<!-- sent funds -->
				{#each (g_overview.spends || []) as g_send}
					<Field key='sent-funds' name='Send funds to contract'>
						<Row
							rootStyle='border:none; padding:calc(0.5 * var(--ui-padding)) 1px;'
							pfp={g_send.pfp}
							name={g_send.amounts.join(' + ')}
						/>
					</Field>
				{/each}

				<Fields configs={[
					...g_overview.fields,
				]}>
				</Fields>
			</div>
		</div>
	{/each}

	{#if a_overviews.length > 1}
		<Gap />
	{:else}
		<hr>
	{/if}

	<Field short key='gas' name='Network Fee'>
		<div style={`
			display: flex;
			justify-content: space-between;
		`}>
			<div>
				<div class="fee-denom">
					{s_fee_total_display}
				</div>
				<div class="fee-fiat global_subvalue">
					<Load input={dp_fee_fiat} />
				</div>
			</div>
			<span class="link font-variant_tiny" style="align-self:end;" on:click={() => click_adjust_fee()}>
				{s_adjust_fee_text}
			</span>
		</div>

		{#if b_show_fee_adjuster}
			<div class="global_inline-form" style="margin-top: 6px;" transition:slide>
				<span class="key">
					Gas limit
				</span>
				<span class="value">
					<input class="global_compact" required type="number" min="0" step="500" bind:value={s_gas_limit}>
				</span>
				<span class="key">
					Gas price
				</span>
				<span class="value">
					<input class="global_compact" required type="number" min="0" step="0.00125" bind:value={s_gas_price}>
				</span>

				<!-- <div class="gas-limit">
					<Field short key="gas-limit" name="Gas limit">
						<input class="global_compact" required type="number" min="0" step="500">
					</Field>
				</div>
				<div class="gas-price">
					<Field short key="gas-prive" name="Gas price">
						<input class="global_compact" required type="number" min="0" step="0.00125">
					</Field>
				</div> -->
			</div>
		{/if}
	</Field>

	<ActionsLine cancel={() => cancel()} confirm={['Approve', approve, !b_loaded]} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>
