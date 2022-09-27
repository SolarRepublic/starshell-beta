<script context="module" lang="ts">

	export type SignaturePreset = '' | 'snip24' | 'snip20ViewingKey' | 'executeAmino';
</script>

<script lang="ts">
	import {Screen} from './_screens';
	import {load_app_context, load_app_profile} from '#/app/svelte';
	import type {AdaptedAminoResponse, AdaptedStdSignature, AdaptedStdSignDoc} from '#/schema/amino';
	import type {Snip24Tx} from '#/schema/snip-24';
	import type {Bech32, ContractInterface} from '#/meta/chain';
	import Field from '../ui/Field.svelte';
	import Row from '../ui/Row.svelte';
	import {Contracts} from '#/store/contracts';
	import {Accounts} from '#/store/accounts';
	import type {SimpleField} from '../ui/IncidentFields.svelte';
	import type {JsonObject, JsonValue, Promisable} from '#/meta/belt';
	import {fold, is_dict, ode, proper} from '#/util/belt';
	import {Chains} from '#/store/chains';
	import type {PfpPath, PfpTarget} from '#/meta/pfp';
	import AppBanner from '../ui/AppBanner.svelte';
	import Copyable from '../ui/Copyable.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import type {AppProfile} from '#/store/apps';
	import {Apps} from '#/store/apps';
	import AsyncLockPool from '#/util/async-lock-pool';
	import Tooltip from '../ui/Tooltip.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import {Networks} from '#/store/networks';
	import StarSelect, {type SelectOption} from '../ui/StarSelect.svelte';
	import SensitiveBytes from '#/crypto/sensitive-bytes';
	import {base64_to_buffer, base93_to_buffer, buffer_to_base64, buffer_to_base93, buffer_to_json, buffer_to_text, json_to_buffer, sha256_sync, text_to_buffer} from '#/util/data';
	import {signAmino} from '#/chain/signing';
	import SigningData from './SigningData.svelte';
	import {Secrets} from '#/store/secrets';
	import {uuid_v4} from '#/util/dom';
	import type { WasmTx } from '#/schema/wasm';
	import { SecretWasm } from '#/crypto/secret-wasm';
	import { Incidents } from '#/store/incidents';
	import { pubkey_to_bech32 } from '#/crypto/bech32';
    import { format_amount } from '#/util/format';
    import FatalError from './FatalError.svelte';

	const {
		g_app,
		g_chain,
		p_account,
		completed,
		k_page,
	} = load_app_context<AdaptedAminoResponse | null>();

	// chain should always be present
	const p_chain = Chains.pathFrom(g_chain);

	export let preset: SignaturePreset | string = '';
	let si_preset: SignaturePreset = preset as SignaturePreset || '';


	export let amino: AdaptedStdSignDoc | null = null;
	const g_amino = amino;

	export let contractAddress: Bech32 | null = null;
	export const sa_wasm = contractAddress;

	export let executeMessage: JsonObject | null = null;
	const h_wasm_exec = executeMessage;
	
	let h_secret_wasm_exec: JsonObject | null = null;

	let s_title = 'Sign Transaction';
	let s_contracts_title = 'Contracts involved';
	let a_contracts: Bech32[] = [];
	let s_tooltip = '';

	let a_simples: SimpleField[] = [];
	let a_simples_after: SimpleField[] = [];

	let a_viewing_key_items: SelectOption[] = [];

	let a_sends: {pfp:PfpTarget; text:string}[] = [];

	const H_PRESETS = {
		snip24() {
			s_title = 'Sign Query Permit';
			s_tooltip = 'Allows apps to view private data such as your token balance, ownership, etc. Scope and permissions are unique to each permit.';

			const g_permit = (g_amino! as Snip24Tx).msgs[0].value;

			s_contracts_title = 'Tokens allowed to be queried';

			a_contracts = g_permit.allowed_tokens;

			a_simples = [
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
			];
		},

		snip20ViewingKey() {
			s_title = 'Add Viewing Key';
			s_tooltip = `Creates a single, revokable key for this specific token that allows anyone with access to view private data such as your token's balance, history, etc.`;

			s_contracts_title = 'Token allowed to be queried';

			a_contracts = [contractAddress!];

			a_simples = [];

			a_viewing_key_items = [
				{
					value: '',
					primary: 'Create new viewing key',
				},
			];
		},

		async executeAmino() {
			s_title = 'Execute Contract';

			const g_exec = (g_amino! as WasmTx).msgs[0].value;

			s_contracts_title = 'Contract';

			a_contracts = [g_exec.contract];

			const {
				message: sx_json,
			} = await SecretWasm.decodeSecretWasmAmino(p_account, g_chain, g_exec.msg);

			let h_exec: JsonObject;
			let si_action: string;
			let h_params: JsonObject;
			try {
				h_exec = JSON.parse(sx_json) as JsonObject;
				if(!is_dict(h_exec)) throw new Error();

				si_action = Object.keys(h_exec)[0];

				h_params = h_exec[si_action] as JsonObject;
				if(!is_dict(h_params)) throw new Error();
			}
			catch(e_parse) {
				a_lint.push({
					error: `Invalid CosmWasm message: \`${sx_json}\``,
				});
				return;
			}

			h_secret_wasm_exec = h_exec;

			if(g_exec.sent_funds?.length) {
				a_sends = [
					{
						pfp: g_chain.pfp,
						text: g_exec.sent_funds.map(g => Chains.summarizeAmount(g, g_chain)),
					},
				];
			}

			a_simples_after = [
				{
					type: 'key_value',
					key: 'Action',
					value: si_action,
				},
				...ode(h_params).map(([si, w]) => ({
					type: 'key_value',
					key: si,
					value: JSON.stringify(w),
				}) as const),
			];
		},
	};

	const S_WARN_TRICK = 'This is an unusual message and might have been designed to trick you.';

	type Lint = {
		warn: string;
		fix: () => Promisable<void>;
	} | {
		error: string;
	}

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

	if(si_preset) {
		H_PRESETS[si_preset]?.();
	}
	else if(amino) {
		const a_msgs = amino.msgs;

		if(1 === a_msgs.length) {
			const g_msg = a_msgs[0];

			if('wasm/MsgExecuteContract' === g_msg.type) {
				si_preset = 'executeAmino';
				H_PRESETS[si_preset]();
			}
		}
	}
	else if(h_wasm_exec) {
		// check for well-known keys
		if('set_viewing_key' in h_wasm_exec) {
			validate_or_warn(h_wasm_exec);
		}
	}

	const kl_profile = new AsyncLockPool(1);
	let b_profile_load_attempted = false;
	let g_profile: AppProfile | undefined;

	async function load_contract(sa_contract: Bech32): Promise<ContractInterface> {
		// create contract path
		const p_contract = Contracts.pathFor(Chains.pathFrom(g_chain), sa_contract);

		// attempt to locate entity
		let g_contract = await Contracts.at(p_contract);

		// definition does not exist in store
		if(!g_contract) {
			// no app profile loaded
			if(!b_profile_load_attempted) {
				// acquire lock on profile
				const f_release = await kl_profile.acquire();

				// still not attempted
				if(!b_profile_load_attempted) {
					// make attempt
					b_profile_load_attempted = true;

					// save profile
					g_profile = await load_app_profile(g_app);
				}

				// release lock
				f_release();
			}

			console.log({
				g_profile,
			});

			// find contract def in app profile
			const h_contracts = g_profile?.contracts;
			if(h_contracts) {
				for(const [, g_def] of ode(h_contracts)) {
					if(sa_contract === g_def.bech32) {
						g_contract = g_def;
					}
				}
			}

			return {
				chain: p_chain,
				hash: g_contract?.hash || '',
				bech32: sa_contract,
				interfaces: g_contract?.interfaces || [],
				name: g_contract?.name || `Unknown Contract from ${g_app.host}`,
				origin: 'domain',
				pfp: '' as PfpPath,
			};
		}

		return g_contract;
	}

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
		const g_account = await Accounts.at(p_account);

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

			case 'executeAmino': {
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
			completed?.(g_completed);
		}
	}

	let b_tooltip_showing = false;
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

	<hr>

	<div class="overview">
		<div class="actions">
			<button class="pill" on:click={() => view_data()}>
				View Data
			</button>
		</div>

		<div class="fields">
			<!-- all simple fields -->
			{#each a_simples as g_field}
				{#if 'key_value' === g_field.type}
					<Field name={g_field.key}>
						{g_field.value}
					</Field>
				{/if}
			{/each}

			<!-- special rules -->
			{#if 'snip20ViewingKey' === si_preset}
				<StarSelect showIndicator items={a_viewing_key_items} disabled={a_viewing_key_items.length < 2}>

				</StarSelect>
			{/if}

			<!-- contracts -->
			{#if a_contracts?.length}
				<Field key='involved-contracts' name={s_contracts_title}>
					{#each a_contracts as sa_contract}
						{#await load_contract(sa_contract)}
							Loading contract...
						{:then g_contract} 
							<Copyable confirmation="Address copied!" let:copy>
								<Row
									appRelated
									rootStyle='border:none; padding:calc(0.5 * var(--ui-padding)) 1px;'
									resource={g_contract}
									pfp={g_contract.pfp || `pfp:${g_app.scheme}://${g_app.host}/${g_chain.namespace}:${g_chain.reference}:${g_contract.bech32}`}
									detail={g_contract.bech32}
									on:click={() => copy(g_contract.bech32)}
								/>
							</Copyable>
						{/await}
					{/each}
				</Field>
			{/if}

			<!-- sent funds -->
			{#each a_sends as g_send}
				<Field key='sent-funds' name='Send funds to contract'>
					<Row
						rootStyle='border:none; padding:calc(0.5 * var(--ui-padding)) 1px;'
						pfp={g_send.pfp}
						name={g_send.text}
					/>
				</Field>
			{/each}

			<!-- all simple fields after -->
			{#each a_simples_after as g_field}
				{#if 'key_value' === g_field.type}
					<Field short name={g_field.key}>
						{g_field.value}
					</Field>
				{/if}
			{/each}

			<hr class="no-margin">

			<Field short key='gas' name='Gas fee'>
				{a_fees.join(', ')}
			</Field>
		</div>
	</div>

	<ActionsLine cancel={() => completed(false)} confirm={['Approve', approve]} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>
