<script context="module" lang="ts">

	export type SignaturePreset = '' | 'snip24' | 'snip20ViewingKey'
	| 'wasm/MsgExecuteContract' | 'wasm/MsgInstantiateContract';
</script>

<script lang="ts">
	import {Screen} from './_screens';
	import {load_app_context} from '#/app/svelte';
	import type {AdaptedAminoResponse, AdaptedStdSignDoc} from '#/schema/amino';
	import type {Snip24PermitMsg, Snip24Tx} from '#/schema/snip-24';
	import type {Bech32, CoinInfo} from '#/meta/chain';
	import Field from '../ui/Field.svelte';
	import Row from '../ui/Row.svelte';
	import {Accounts} from '#/store/accounts';
	import type {Dict, JsonObject, Promisable} from '#/meta/belt';
	import {fold, forever, is_dict, proper} from '#/util/belt';
	import {Chains} from '#/store/chains';
	import AppBanner from '../ui/AppBanner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import {Apps} from '#/store/apps';
	import Tooltip from '../ui/Tooltip.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import {Providers} from '#/store/providers';
	import StarSelect, {type SelectOption} from '../ui/StarSelect.svelte';
	import SensitiveBytes from '#/crypto/sensitive-bytes';
	import {buffer_to_base64, buffer_to_base93, buffer_to_hex, json_to_buffer} from '#/util/data';
	import {signAmino} from '#/chain/signing';
	import SigningData from './SigningData.svelte';
	import {Secrets} from '#/store/secrets';
	import {uuid_v4} from '#/util/dom';
	import {Incidents} from '#/store/incidents';
	import {pubkey_to_bech32} from '#/crypto/bech32';
	import FatalError from './FatalError.svelte';
	import Fields from '../ui/Fields.svelte';
	import {JsonPreviewer} from '../helper/json-previewer';
	import {yw_network} from '../mem';
	import type {SecretNetwork} from '#/chain/secret-network';
	import {H_INTERPRETTERS, type InterprettedMessage} from '#/chain/msg-interpreters';
    import Load from '../ui/Load.svelte';
    import { amino_to_base, encode_proto } from '#/chain/cosmos-msgs';
    import { AuthInfo, TxBody, TxRaw } from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
    import type { AccountInterface } from '#/meta/account';
    import { Coins } from '#/chain/coin';
    import BigNumber from 'bignumber.js';
    import type { Coin } from '@cosmjs/amino';
    import { format_fiat } from '#/util/format';
    import { slide } from 'svelte/transition';

	const g_context = load_app_context<AdaptedAminoResponse | null>();
	const {
		g_app,
		g_chain,
		p_account,
		completed,
		k_page,
	} = g_context;

	// chain should always be present
	const p_chain = Chains.pathFrom(g_chain);

	const dp_account = Accounts.at(p_account) as Promise<AccountInterface>;

	/**
	 * Will be set if SIGN_MODE_LEGACY_AMINO_JSON is being used
	 */
	export let amino: AdaptedStdSignDoc | null = null;
	const g_amino = amino;


	export let preset: SignaturePreset | string = '';
	let si_preset: SignaturePreset = preset as SignaturePreset || '';


	export let contractAddress: Bech32 | null = null;
	export const sa_wasm = contractAddress;

	export let executeMessage: JsonObject | null = null;
	const h_wasm_exec = executeMessage;
	
	const h_secret_wasm_exec: JsonObject | null = null;

	let s_title = 'Sign Transaction';
	let s_tooltip = '';

	let a_viewing_key_items: SelectOption[] = [];

	/**
	 * Set to true once the document has completely loaded
	 */
	let b_loaded = false;

	const H_PRESETS: Dict<(g_value: JsonObject) => Promisable<InterprettedMessage>> = {
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
					},
				],
			} as InterprettedMessage;
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

				si_preset = 'snip20ViewingKey';
				break;
			}

			default: {
				// 
			}
		}

		a_lint = a_lint_local;
	}

	let a_overviews: InterprettedMessage[] = [];


	async function interpret_message(g_msg): Promise<InterprettedMessage> {
		const si_amino = g_msg.type;

		if(si_amino in H_INTERPRETTERS) {
			return await H_INTERPRETTERS[si_amino](g_msg.value as JsonObject, g_context);
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
		// amino doc
		if(amino) {
			const a_msgs = amino.msgs;

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
					: await interpret_message(a_msgs[0]);

				// lift properties from overview
				s_title = g_overview.title;
				s_tooltip = g_overview.tooltip;

				// assign
				a_overviews = [g_overview];
			}
			// multiple messages
			else {
				a_overviews = await Promise.all(a_msgs.map(interpret_message));
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
		if('snip24' === si_preset) {
			k_page.push({
				creator: SigningData,
				props: {
					preset,
					amino,
				},
			});
		}
		else if(amino) {
			k_page.push({
				creator: SigningData,
				props: {
					amino,
					wasm: h_secret_wasm_exec,
				},
			});
		}
	}

	let a_fees: string[] = [];
	if(g_amino) {
		a_fees = g_amino.fee.amount.map(g_amount => Chains.summarizeAmount(g_amount, g_chain));
	}

	async function approve() {
		const g_account = await dp_account;
		debugger;
		if(!g_account) {
			throw new Error('Account does not exist?!');
		}

		const sa_sender = pubkey_to_bech32(g_account.pubkey, g_chain.bech32s.acc);

		let g_completed!: AdaptedAminoResponse;
		if(g_amino) {
			try {
				const g_signature = await signAmino(g_account, g_amino);
				g_completed = {
					signed: g_amino,
					signature: g_signature,
				};
			}
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

		let b_incident_reported = false;

		switch(si_preset) {
			// snip-24
			case 'snip24': {
				// ref permit data
				const g_permit = (g_amino! as Snip24Tx).msgs[0].value;

				// store permit
				const p_permit = await Secrets.put(json_to_buffer(g_completed), {
					type: 'query_permit',
					uuid: uuid_v4(),
					name: g_permit.permit_name,
					security: {
						type: 'none',
					},
					app: Apps.pathFrom(g_app),
					outlets: [],
					chain: p_chain,
					contracts: fold(g_permit.allowed_tokens, sa_contract => ({
						[sa_contract]: '',
					})),
					permissions: g_permit.permissions,
				});

				// record incident
				await Incidents.record({
					type: 'signed_json',
					data: {
						account: p_account,
						events: {
							query_permit: {
								secret: p_permit,
							},
						},
					},
				});

				b_incident_reported = true;

				break;
			}

			case 'snip20ViewingKey': {
				const k_network = await Networks.activateDefaultFor(g_chain);

				await k_network.encodeExecuteContract(g_account, sa_wasm!, h_wasm_exec!, 'CODE HASH');
				break;
			}

			case 'wasm/MsgExecuteContract': {
				if(g_chain.features.secretwasm) {
					// TODO: precompute txn hash

					// await Incidents.record({
					// 	type: 'tx_out',
					// 	data: {
					// 		stage: 'pending',
					// 		chain: p_chain,
					// 		code: 0,
					// 		hash: si_txn,
					// 		raw_log: '',
					// 		gas_limit: '' as Cw.Uint128,
					// 		gas_wanted: '' as Cw.Uint128,
					// 		gas_used: '' as Cw.Uint128,
					// 		msgs: [],
					// 	} as TxPending,
					// });

					// console.log({si_txn});
					// debugger;
				}
				else {
					// MsgExecuteContract.fromPartial({
					// 	sender: sa_sender,
					// 	contract: a_contracts[0],
					// 	msg: base64_to_buffer((g_amino! as WasmTx).msgs[0].value.msg),
					// 	funds: [],
					// });
				}

				break;
			}

			default: {
				break;
			}
		}

		if(g_completed) {
			completed?.(true, g_completed);
		}
	}

	let s_gas_limit = '0';
	let s_gas_price = '0';

	let g_fee_coin_info: CoinInfo;

	let s_fee_total = '0';
	let s_fee_total_display = '0';
	let dp_fee_fiat: Promise<string> = forever();
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

			dp_fee_fiat = Coins.displayInfo(g_coin, g_chain).then((g_display) => {
				return `=${format_fiat(g_display.fiat, g_display.versus)}`;
			});
		}
	}

	{
		if(amino) {
			// get fee coin from chain
			const [si_coin, g_info] = Chains.feeCoin(g_chain);

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
						h_prices_app[g_coin.denom] = BigNumber(g_coin.amount as string).dividedBy(s_gas_limit);
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
		}
	}

	function estimate_gas(): {
		id: string;
		info: CoinInfo;
		amount: string;
		coin: Coin;
	} {
		if(amino) {
			// get fee coin from chain
			const [si_coin, g_info] = Chains.feeCoin(g_chain);

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
	{#await Accounts.at(p_account)}
		<AppBanner app={g_app} chain={g_chain} on:close={() => completed(false)}>
			<span slot="default" style="display:contents;">
				{s_title}
			</span>
			<span slot="context" style="display:contents;">
				[...]
			</span>
		</AppBanner>
	{:then g_account}
		<AppBanner app={g_app} chain={g_chain} account={g_account} on:close={() => completed(false)}>
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

	{#each a_overviews as g_overview}
		<hr>

		<div class="overview">
			<div class="actions">
				<button class="pill" on:click={() => view_data()}>
					View Data
				</button>
			</div>

			<div class="fields">
				<!-- special rules -->
				{#if 'snip20ViewingKey' === si_preset}
					<StarSelect showIndicator items={a_viewing_key_items} disabled={a_viewing_key_items.length < 2}>

					</StarSelect>
				{/if}

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
					// ...(g_overview.spends || []).map((g_send) => ({
					// 	type: 'key_value',
					// 	key: 'Send funds to contract',
					// 	value: g_send.amounts.join(' + '),
					// })),
					{
						type: 'slot',
						index: 0,
					},
					// {
					// 	type: 'slot',
					// 	index: 1,
					// },
				]}>
					<svelte:fragment slot="slot_0">
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
					</svelte:fragment>

					<svelte:fragment slot="slot_1">
						<Field short key='total' name='Total Cost'>

						</Field>
					</svelte:fragment>
				</Fields>
			</div>
		</div>
	{/each}

	<ActionsLine cancel={() => completed(false)} confirm={['Approve', approve, !b_loaded]} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>
