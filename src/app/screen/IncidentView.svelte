<script lang="ts">
	import {Tab, TabList, TabPanel, Tabs} from 'svelte-tabs';
	import {Header, Screen} from './_screens';
	
	import {JsonView} from '@zerodevx/svelte-json-view';

	import {format_amount, format_fiat, format_time} from '#/util/format';
	
	import {parse_coin_amount, to_fiat} from '#/chain/coin';
	import type {Chain, ChainInterface, ChainPath} from '#/meta/chain';
	import type {Incident, IncidentInterface, IncidentPath, IncidentType, TxConfirmed, TxPending, TxSynced} from '#/meta/incident';
	import {R_TRANSFER_AMOUNT} from '#/share/constants';
	import {Chains} from '#/store/chains';
	import {
		type ActiveNetwork,
		Providers,
	} from '#/store/providers';
	import type {JsonObject, JsonValue} from '#/meta/belt';
	import {ode, oderac} from '#/util/belt';
	import {buffer_to_base64} from '#/util/data';
	import BigNumber from 'bignumber.js';
	import {syswarn} from '../common';
	import ActionsLine from '../ui/ActionsLine.svelte';

	import SX_ICON_LAUNCH from '#/icon/launch.svg?raw';
	import {Incidents} from '#/store/incidents';
	import {MsgSend} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/tx';
	import {PubKey} from '@solar-republic/cosmos-grpc/dist/cosmos/crypto/secp256k1/keys';
	import {Tx} from '@solar-republic/cosmos-grpc/dist/cosmos/tx/v1beta1/tx';
	import type {SimpleField} from '../ui/IncidentFields.svelte';
	import IncidentFields from '../ui/IncidentFields.svelte';
	import {Apps} from '#/store/apps';
	import {Accounts} from '#/store/accounts';
	import Field from '../ui/Field.svelte';
	import {load_flow_context} from '../svelte';
    import type { FieldConfig } from '../ui/Fields.svelte';

	const {
		completed,
	} = load_flow_context();

	function complete() {
		completed!(true);
	}

	export let incident: IncidentPath;
	const p_incident = incident;

	interface EventViewConfig {
		s_title: string;
		a_fields: SimpleField[];
	}
		// const a_fields: SimpleField[] = [];
	async function pretty_amount(s_input: string, p_chain: ChainPath): Promise<string> {
		// attempt to parse amount
		const m_amount = R_TRANSFER_AMOUNT.exec(s_input);
		if(!m_amount) {
			syswarn({
				text: `Failed to parse transfer amount "${s_input}"`,
			});
		}
		else {
			// destructure into amount and denom
			const [, s_amount, si_denom] = m_amount;

			const g_chain = (await Chains.at(p_chain))!;

			// locate coin
			for(const [si_coin_test, g_coin_test] of ode(g_chain.coins)) {
				if(si_denom === g_coin_test.denom) {
					const x_amount = new BigNumber(s_amount).shiftedBy(-g_coin_test.decimals).toNumber();
					return `${format_amount(x_amount, true)} ${si_coin_test}`;
				}
			}
		}

		return s_input;
	}

	const f_send_recv = (g_data: TxPending | TxConfirmed | TxSynced) => [
		...'string' === typeof g_data['memo']? [{
			type: 'memo',
			text: g_data['memo'],
		} as const]: [],
		...g_data['hash'] && [{
			type: 'links',
			value: (async() => {
				const g_chain = (await Chains.at(g_data.chain))!;
				return [
					{
						href: Chains.blockExplorer('transaction', {
							...g_data,
							chain_prefix: g_chain.reference.replace(/-.+$/, ''),
						}, g_chain),
						icon: SX_ICON_LAUNCH,
						text: 'Block explorer',
					},
				];
			})(),
		}],
	] as FieldConfig[];

	let s_fiat_amount = '';

	const H_RELABELS = {
		'extra.pfpg.offset': 'pfp offset',
	};

	const relabel = s => H_RELABELS[s] ?? s;

	const H_EVENTS: {
		[si_type in IncidentType]: (g_data: Incident.Struct<si_type>['data'], g_chain: ChainInterface) => EventViewConfig;
	} = {
		tx_out: (g_data, g_chain) => {
			if('confirmed' === g_data.stage || 'synced' === g_data.stage) {
				const g_msg = g_data.msgs[0];
				const h_events = g_msg.events;

				if(h_events.transfer) {
					const g_transfer = h_events.transfer;
					const [xg_amount, si_coin, g_coin] = parse_coin_amount(g_transfer.amount, g_chain);

					// missing fiat
					if('synced' === g_data.stage && !('usd' in (g_data.fiats || {}))) {
						const m_amount = R_TRANSFER_AMOUNT.exec(g_transfer.amount);
						if(m_amount) {
							void to_fiat({
								amount: m_amount[1],
								denom: m_amount[2],
							}, g_coin, 'usd').then((yg_fiat) => {
								void Incidents.mutateData(p_incident, {
									fiats: {
										usd: yg_fiat.toNumber(),
									},
								}).then(() => {
									s_fiat_amount = format_fiat(yg_fiat.toNumber(), 'usd');
								});
							});
						}
					}

					return {
						s_title: `Sent ${si_coin}`,
						a_fields: [
							{
								type: 'key_value',
								key: 'Status',
								value: 'Confirmed',
							},
							{
								type: 'key_value',
								key: 'Sender',
								value: g_transfer.sender,
								render: 'address',
							},
							{
								type: 'key_value',
								key: 'Recipient',
								value: g_transfer.recipient,
								render: 'address',
							},
							{
								type: 'key_value',
								key: 'Amount',
								value: pretty_amount(g_transfer.amount, g_data.chain),
								// subvalue: `${format_amount(Number(xg_amount))} ${g_coin.denom}`,
							},
							{
								type: 'key_value',
								key: 'Fiat',
								value: 'usd' in (g_data.fiats || {})? format_fiat(g_data.fiats['usd'], 'usd'): '',
							},
							{
								type: 'key_value',
								key: 'Fee',
								value: `${format_amount(new BigNumber(g_data.gas_wanted).shiftedBy(-g_coin.decimals).toNumber())} ${si_coin}`,
								subvalue: `${format_amount(+g_data.gas_wanted)} ${g_coin.denom}`,
							},
							// {
							// 	type: 'key_value',
							// 	key: 'Total',
							// 	value: `${format_amount(g_data.gas_wanted)}`,
							// },
							...f_send_recv(g_data),
						],
					};
				}
			}
			else {
				const g_msg = g_data.msgs[0];
				const h_events = g_msg.events;

				if(h_events.transfer) {
					const g_transfer = h_events.transfer;
					const [xg_amount, si_coin, g_coin] = parse_coin_amount(g_transfer.amount, g_chain);

					return {
						s_title: `Send ${si_coin}`,
						a_fields: [
							{
								type: 'key_value',
								key: 'Status',
								value: 'Confirmed',
							},
							{
								type: 'key_value',
								key: 'Sender',
								value: g_transfer.sender,
								render: 'address',
							},
							{
								type: 'key_value',
								key: 'Recipient',
								value: g_transfer.recipient,
								render: 'address',
							},
							{
								type: 'key_value',
								key: 'Amount',
								value: pretty_amount(g_transfer.amount, g_data.chain),
								// subvalue: `${format_amount(Number(xg_amount))} ${g_coin.denom}`,
							},
							{
								type: 'key_value',
								key: 'Fee',
								value: `${format_amount(new BigNumber(g_data.gas_wanted).shiftedBy(-g_coin.decimals).toNumber())} ${si_coin}`,
								subvalue: `${format_amount(+g_data.gas_wanted)} ${g_coin.denom}`,
							},
							// {
							// 	type: 'key_value',
							// 	key: 'Total',
							// 	value: `${format_amount(g_data.gas_wanted)}`,
							// },
							...f_send_recv(g_data),
						],
					};
				}
			}

			return {
				s_title: 'Pending',
				a_fields: [],
			};
		},

		tx_in: (g_data, g_chain) => {
			const g_msg = g_data.msgs[0];
			const h_events = g_msg.events;

			if(h_events.transfer) {
				const g_transfer = h_events.transfer;
				const [xg_amount, si_coin, g_coin] = parse_coin_amount(g_transfer.amount, g_chain);

				return {
					s_title: `Received ${si_coin}`,
					a_fields: [
						{
							type: 'key_value',
							key: 'Status',
							value: 'Confirmed',
						},
						{
							type: 'key_value',
							key: 'Sender',
							value: g_transfer.sender,
							render: 'address',
						},
						{
							type: 'key_value',
							key: 'Recipient',
							value: g_transfer.recipient,
							render: 'address',
						},
						{
							type: 'key_value',
							key: 'Amount',
							value: pretty_amount(g_transfer.amount, g_data.chain),
							subvalue: `${new BigNumber(''+xg_amount).shiftedBy(-g_coin.decimals).toString()} ${si_coin}`,
						},
						...f_send_recv(g_data),
					],
				};
			}

			return {
				s_title: 'pending',
				a_fields: [],
			};
		},

		account_created: g_data => ({
			s_title: `Created Account`,
			a_fields: [
				{
					type: 'key_value',
					key: 'Account',
					value: Accounts.at(g_data.account).then(g => g!.name),
				},
			],
		}),

		account_edited: g_data => ({
			s_title: `Edited Account`,
			a_fields: [
				{
					type: 'key_value',
					key: 'Account',
					value: Accounts.at(g_data.account).then(g => g!.name),
				},
				...g_data.deltas.map(a => ({
					type: 'key_value' as const,
					key: `Changed ${relabel(a[0])}`,
					value: `${a[1]} → ${a[2]}`,
					long: true,
				})),
			],
		}),

		app_connected: g_data => ({
			s_title: 'App Connected',
			a_fields: [
				{
					type: 'key_value',
					key: 'App',
					value: Apps.parsePath(g_data.app)[1],
				},
				{
					type: 'key_value',
					key: 'Accounts',
					value: Promise.all(g_data.accounts
						.map(async p_account => (await Accounts.at(p_account))!.name)
						.join(', ')),
				},
				{
					type: 'key_value',
					key: 'Permissions',
					value: oderac(g_data.connections, (si_key, g_permission) => `${si_key}:${JSON.stringify(g_permission)}`)
						.join(', '),
				},
			],
		}),
	};

	let g_incident!: IncidentInterface;
	let g_chain: ChainInterface | null;
	let k_network: ActiveNetwork;

	let s_time = '';
	let s_title = '';
	let a_fields: SimpleField[] = [];
	const dp_loaded = (async() => {
		g_incident = (await Incidents.at(p_incident))!;

		const g_data = g_incident.data;

		g_chain = g_data['chain']? await Chains.at(g_data['chain'] as ChainPath): null;

		if(g_chain) {
			k_network = await Providers.activateDefaultFor(g_chain);
		}

		s_time = format_time(g_incident.time);

		({
			s_title,
			a_fields,
		} = H_EVENTS[g_incident.type](g_data, g_chain));
	})();

	// const {
	// 	s_title,
	// 	a_fields,
	// } = H_EVENTS[event.type](event.data);


	const H_GRPC_MAP = {
		'/cosmos.bank.v1beta1.MsgSend': MsgSend,
		'/cosmos.crypto.secp256k1.PubKey': PubKey,
		'/cosmos.tx.v1beta1.Tx': Tx,
	};

	function recode(w_value: JsonValue) {
		if(w_value && 'object' === typeof w_value) {
			// array of values
			if(Array.isArray(w_value)) {
				return w_value.map(recode);
			}
			// raw data; replace with base64 encoding
			else if(ArrayBuffer.isView(w_value)) {
				return buffer_to_base64(w_value as unknown as Uint8Array);
			}
			// nested object
			else {
				return decode_proto(w_value);
			}
		}

		return w_value;
	}

	function decode_proto(g_top: JsonObject): JsonObject {
		// proto thing
		const si_proto = g_top.typeUrl;
		if('string' === typeof si_proto) {
			// has value
			if(ArrayBuffer.isView(g_top.value)) {
				if(si_proto in H_GRPC_MAP) {
					return {
						'@type': si_proto,
						...decode_proto(H_GRPC_MAP[si_proto].decode(g_top.value) as unknown as JsonObject),
					};
				}
			}
		}

		for(const [si_key, w_value] of ode(g_top)) {
			const si_type = typeof w_value;

			// ignore functions and undefined
			if('function' === si_type || 'undefined' === si_type) {
				delete g_top[si_key];
				continue;
			}

			// recode everything else
			g_top[si_key] = recode(w_value);
		}

		return g_top;
	}

	async function load_raw_json() {
		await dp_loaded;

		const g_response = await k_network.fetchTx(g_incident.data.hash);

		const g_formatted = decode_proto(g_response);

		return g_formatted;
	}
</script>

<style lang="less">
	@import './_base.less';

	.subvalue {
		.font(tiny);
		color: var(--theme-color-text-med);
	}

	.raw-json {
		background-color: fade(@theme-color-graydark, 50%);
		color: var(--theme-color-text-light);
		overflow: scroll;
		padding: 1em;
		border-radius: 4px;
		.font(mono-tiny);
		margin-bottom: var(--ui-padding);
	}
</style>

<Screen>
	<Header
		pops={!completed}
		title={s_title}
		subtitle={s_time}
	/>

	{#if s_title}
		{#if 'tx_in' === g_incident.type || 'tx_out' === g_incident.type}
			<Tabs>
				<TabList>
					<Tab>
						Overview
					</Tab>

					<Tab>
						Raw JSON
					</Tab>
				</TabList>

				<!-- Overview -->
				<TabPanel>
					<span>&nbsp;</span>

					<Field
						short
						key='datetime'
						name='Date'
					>
						{new Intl.DateTimeFormat('en-US', {
							year: 'numeric',
month: 'numeric',
day: 'numeric',
							hour: 'numeric',
minute: 'numeric',
second: 'numeric',
							hour12: false,
							timeZone: 'America/Los_Angeles',
						}).format(new Date(g_incident.time))}
					</Field>

					<IncidentFields
						incident={g_incident}
						fields={a_fields}
						chain={g_chain}
						network={k_network}
						loaded={dp_loaded}
					/>
				</TabPanel>

				<!-- Raw JSON -->
				<TabPanel>
					<span>&nbsp;</span>

					{#await load_raw_json()}
						Loading JSON...
					{:then g_response}
						<div class="raw-json">
							<JsonView
								--nodeColor='var(--theme-color-text-light)'
								json={g_response}
							/>
						</div>
					{/await}
				</TabPanel>
			</Tabs>
		{:else}
			<span>&nbsp;</span>

			<Field
				short
				key='datetime'
				name='Date'
			>
				{new Intl.DateTimeFormat('en-US', {
					year: 'numeric',
month: 'numeric',
day: 'numeric',
					hour: 'numeric',
minute: 'numeric',
second: 'numeric',
					hour12: false,
					timeZone: 'America/Los_Angeles',
				}).format(new Date(g_incident.time))}
			</Field>

			<IncidentFields
				incident={g_incident}
				fields={a_fields}
				chain={g_chain}
				network={k_network}
				loaded={dp_loaded}
			/>
		{/if}
	{/if}


	{#if completed}
		<ActionsLine confirm={['Done', complete]} />
	{/if}
</Screen>
