<script context="module" type="ts">
	import type {Promisable} from '#/meta/belt';
	import type {ChainStruct} from '#/meta/chain';
	import type {PfpTarget} from '#/meta/pfp';

	import type {Incident, TxSynced} from '#/meta/incident';
	import type { CosmosNetwork } from '#/chain/cosmos-network';

	import {forever} from '#/util/belt';
	import {open_external_link} from '#/util/dom';

	import Address from './Address.svelte';
	import Field from '../ui/Field.svelte';
	import Load from '../ui/Load.svelte';
	import MemoReview from './MemoReview.svelte';
	

	export type SimpleField = {
		type: 'key_value';
		key: string;
		long?: boolean;
		value: Promisable<string>;
		subvalue?: Promisable<string>;
		render?: 'address';
		pfp?: PfpTarget;
	} | {
		type: 'memo';
		value: string;
	} | {
		type: 'links';
		value: Promisable<{
			href: string;
			text: string;
			icon?: string;
		}[]>;
	};
</script>


<script type="ts">
	import {syserr} from '../common';
	import {ecdh_nonce, extract_memo_ciphertext} from '#/crypto/privacy';
	import {Accounts} from '#/store/accounts';
	import {buffer_to_text} from '#/util/data';
	import {yw_chain} from '../mem';
	import PfpDisplay from './PfpDisplay.svelte';

	export let fields: SimpleField[];
	export let incident: Incident.Struct | null = null;
	export let chain: ChainStruct | null = null;
	export let network: CosmosNetwork | null = null;
	export let loaded: Promise<any> | null = null;

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

		const sa_owner = (b_outgoing? sa_sender: sa_recipient) as string;
		const sa_other = (b_outgoing? sa_recipient: sa_sender) as string;

		const [, g_account] = await Accounts.find(sa_owner, $yw_chain);

		// const g_chain = (await Chains.at(p_chain))!;

		// wait for load to complete
		await loaded;

		// locate others's public key
		let atu8_pubkey_65: Uint8Array;
		try {
			({
				pubkey: atu8_pubkey_65,
			} = await network.e2eInfoFor(sa_other));
		}
		catch(e_info) {
			throw syserr({
				title: 'Other Account Unpublished',
				error: e_info,
			});
		}

		const atu8_nonce = await ecdh_nonce(s_sequence, s_gas_wanted);

		const atu8_ciphertext = extract_memo_ciphertext(s_memo);

		const atu8_plaintext = await network.ecdhDecrypt(atu8_pubkey_65, atu8_ciphertext, atu8_nonce, chain, g_account);

		return buffer_to_text(atu8_plaintext).replace(/\0+$/, '');
	}

</script>

{#each fields as g_field}
	<hr>

	{#if 'key_value' === g_field.type}
		<Field
			short={!g_field.long && !g_field.pfp}
			key={g_field.key.toLowerCase()}
			name={g_field.key}
		>
			<div style="display:flex;">
				{#if g_field.pfp}
					<PfpDisplay dim={32} path={g_field.pfp} />
				{/if}

				<div style="display:flex; flex-flow:column;">
					{#await g_field.value}
						<Load forever />
					{:then s_value}
						{#if 'address' === g_field.render}
							<Address address={s_value} copyable />
						{:else}
							{s_value}
						{/if}
					{/await}

					{#if g_field.subvalue}
						<div class="subvalue">
							<Load input={g_field.subvalue} />
						</div>
					{/if}
				</div>
			</div>
		</Field>
	{:else if 'memo' === g_field.type}
		{#if g_field.value?.startsWith('🔒1')}
			{#await decrypt_memo(g_field.value)}
				<MemoReview
					memoPlaintext={forever('')}
					memoCiphertext={forever('')}
				/>
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
				<Load forever />
			{:then a_links}
				{#each a_links as g_link}
					<span class="link" on:click={() => open_external_link(g_link.href)}>
						{#if g_link.icon}
							<span class="global_svg-icon icon-diameter_20px">
								{@html g_link.icon}
							</span>
						{/if}
						<span class="text">
							{g_link.text}
						</span>
					</span>
				{/each}
			{/await}
		</div>
	{/if}
{/each}