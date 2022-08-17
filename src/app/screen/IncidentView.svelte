<script lang="ts">
	import {onMount} from 'svelte';
	import {Screen, Header, type Page} from './_screens';

	import { format_amount, format_time } from '#/util/format';
	import Field from '../ui/Field.svelte';
	import MemoReview from '../ui/MemoReview.svelte';
	import { decrypt } from '#/crypto/vault';
	import { Accounts } from '#/store/accounts';
	import { Chains } from '#/store/chains';
	import type { Account, AccountPath } from '#/meta/account';
	import { Networks } from '#/store/networks';
	import { syserr, syswarn } from '../common';
	import { base93_to_buffer, buffer_to_text, sha256, text_to_buffer } from '#/util/data';
	import type { Chain, ChainPath, NativeCoin } from '#/meta/chain';
	import { R_TRANSFER_AMOUNT } from '#/share/constants';
	import { ode, Promisable } from '#/util/belt';
	import BigNumber from 'bignumber.js';
	import { open_external_link } from '#/util/dom';
	import type { Incident, IncidentType, TxConfirmed, TxPending, TxSynced } from '#/meta/incident';
	import { parse_coin_amount } from '#/chain/coin';
	import { ecdhNonce, extractMemoCiphertext } from '#/crypto/privacy';
	import Address from '../ui/Address.svelte';

	export let incident: Incident['interface'];

	interface EventViewConfig {
		s_title: string;
		a_fields: SimpleField[];
	}

	type SimpleField = {
		type: 'key_value';
		key: string;
		value: Promisable<string>;
		render?: 'address';
	} | {
		type: 'memo';
		value: string;
	} | {
		type: 'links';
		value: Promisable<{
			href: string;
			text: string;
		}[]>;
	};

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
			value: g_data['memo'],
		} as const]: [],
		{
			type: 'links',
			value: (async() => {
				const g_chain = (await Chains.at(g_data.chain))!;
				return [
					{
						href: Chains.blockExplorer('transaction', {
							...g_data,
							chain_prefix: g_chain.id.replace(/-.+$/, ''),
						}, g_chain),
						text: 'View on block explorer',
					},
				];
			})(),
		},
	] as SimpleField[];

	const H_EVENTS: {
		[si_type in IncidentType]: (g_data: Incident.Struct<si_type>['data'], g_chain: Chain['interface']) => EventViewConfig;
	} = {
		tx_out: (g_data, g_chain) => {
			if('confirmed' === g_data.stage || 'synced' === g_data.stage) {
				const g_msg = g_data.msgs[0];
				const h_events = g_msg.events;

				if(h_events.transfer) {
					const g_transfer = h_events.transfer;
					const [xg_amount, si_coin] = parse_coin_amount(g_transfer.amount, g_chain);

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
							},
							{
								type: 'key_value',
								key: 'Fee',
								value: `${format_amount(+g_data.gas_wanted)} GAS`,
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
				const [xg_amount, si_coin] = parse_coin_amount(g_transfer.amount, g_chain);

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
							value: `${xg_amount}`,
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
			a_fields: [],
		}),

		// pending: g_data => ({
		// 	s_title: `Pending Transaction`,
		// 	a_fields: [
		// 		{
		// 			type: 'key_value',
		// 			key: 'Status',
		// 			value: 'Pending',
		// 		},
		// 	],
		// }),
	};

	let s_title = '';
	let a_fields: SimpleField[] = [];
	(async() => {
		const g_data = incident.data;

		const g_chain = g_data['chain']? await Chains.at(g_data['chain'] as ChainPath): null;

		({
			s_title,
			a_fields,
		} = H_EVENTS[incident.type](g_data, g_chain));
	})();

	// const {
	// 	s_title,
	// 	a_fields,
	// } = H_EVENTS[event.type](event.data);

	const s_time = format_time(incident.time);

	async function decrypt_memo(s_memo: string): Promise<string> {
		const {
			chain: p_chain,
			height: s_height,
			msgs: [
				{
					events: {
						transfer: g_transfer,
					},
				},
			],
			gas_wanted: s_gas_wanted,
			signers: a_signers,
		} = (incident as Incident.Struct<'tx_in' | 'tx_out'>).data as TxSynced;

		const s_sequence = a_signers![0].sequence;

		const {
			recipient: sa_recipient,
			sender: sa_sender,
		} = g_transfer!;


		const b_outgoing = 'tx_out' === incident.type;

		const g_chain = (await Chains.at(p_chain))!;

		const ks_accounts = await Accounts.read();

		const sa_owner = (b_outgoing? sa_sender: sa_recipient) as string;
		const sa_other = (b_outgoing? sa_recipient: sa_sender) as string;

		let p_account!: AccountPath;
		let g_account!: Account['interface'];
		for(const [p_account_test, g_account_test] of ks_accounts.entries()) {
			const sa_test = Chains.addressFor(g_account_test.pubkey, g_chain);
			if(sa_test === sa_owner) {
				p_account = p_account_test;
				g_account = g_account_test;
				break;
			}
		}

		if(!p_account) throw new Error(`Transaction is not associated with any accounts in this wallet`);

		const k_network = await Networks.activateDefaultFor(g_chain);

		// locate others's public key
		let atu8_pubkey_65: Uint8Array;
		try {
			({
				pubkey: atu8_pubkey_65,
			} = await k_network.e2eInfoFor(sa_other));
		}
		catch(e_info) {
			throw syserr({
				title: 'Other Account Unpublished',
				error: e_info,
			});
		}

		const atu8_nonce = await ecdhNonce(s_sequence, s_gas_wanted);

		const atu8_ciphertext = extractMemoCiphertext(s_memo);

		const atu8_plaintext = await k_network.ecdhDecrypt(atu8_pubkey_65, atu8_ciphertext, atu8_nonce);

		return buffer_to_text(atu8_plaintext).replace(/\0+$/, '');
	}
</script>

<style lang="less">
	
</style>

<Screen>
	<Header
		pops
		title={s_title}
		subtitle={s_time}
	/>


	{#each a_fields as g_field}
		<hr>

		{#if 'key_value' === g_field.type}
			<Field
				short
				key={g_field.key.toLowerCase()}
				name={g_field.key}
			>
				{#await g_field.value}
					Loading...
				{:then s_value}
					{#if 'address' === g_field.render}
						<Address address={s_value} copyable />
					{:else}
						{s_value}
					{/if}
				{/await}
			</Field>
		{:else if 'memo' === g_field.type}
			{#if g_field.value?.startsWith('🔒1')}
				{#await decrypt_memo(g_field.value)}
					Decrypting memo....
				{:then s_plaintext}
					<MemoReview
						memoPlaintext={s_plaintext}
						memoCiphertext={g_field.value}
					/>
				{:catch}
					<MemoReview
						memoPlaintext={null}
						memoCiphertext={g_field.value}
					/>
				{/await}
			{:else}
				<MemoReview
					memoPlaintext={g_field.value || ''}
				/>
			{/if}
		{:else if 'links' === g_field.type}
			<div class="links">
				{#await g_field.value}
					Loading...
				{:then a_links}
					{#each a_links as g_link}
						<span class="link" on:click={() => open_external_link(g_link.href)}>
							{g_link.text}
						</span>
					{/each}
				{/await}
			</div>
		{/if}
	{/each}
</Screen>
