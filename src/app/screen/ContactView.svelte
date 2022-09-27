<script lang="ts">
	import {yw_account, yw_chain} from '##/mem';
	import type { Contact, ContactPath } from '#/meta/contact';
	import { Agents } from '#/store/agents';
	import { Chains } from '#/store/chains';
	import { getContext } from 'svelte';
	
	import { Header, type Page, Screen } from '../screen/_screens';
	import Address from '##/ui/Address.svelte';
	import Portrait from '##/ui/Portrait.svelte';
	import Send from '##/screen/Send.svelte';
	// import TxnList, { TxnContext } from '##/ui/TxnList.svelte';
	import ContactEdit from './ContactEdit.svelte';
	import DeadEnd from './DeadEnd.svelte';


	export let contactRef: ContactPath;
	const p_contact = contactRef;

	let g_contact: Contact['interface'];
	void Agents.getContact(p_contact).then(g => g_contact = g!);

	$: sa_contact = g_contact? Chains.transformBech32(g_contact.address, $yw_chain): '';

	const k_page = getContext<Page>('page');

	const gc_actions = {
		send: {
			label: 'Send',
			trigger() {
				k_page.push({
					creator: Send,
					props: {
						to: Chains.transformBech32(g_contact.address, $yw_chain),
					},
				});
			},
		},
		edit: {
			label: 'Edit',
			trigger() {
				k_page.push({
					creator: ContactEdit,
					props: {
						contactRef: p_contact,
					},
				});
			},
		},
		delete: {
			label: 'Delete',
			trigger() {
				k_page.push({
					creator: DeadEnd,
				});
			},
		},
	};

	// $: a_txns = A_TXNS.filter((k_txn) => {
	// 	const gd_txn = k_txn.def;

	// 	if(sa_contact === gd_txn.address) return true;

	// 	const g_bankish = k_txn.bankish($yw_account.address($yw_chain));
	// 	if(g_bankish) {
	// 		return sa_contact === g_bankish.address;
	// 	}

	// 	return false;
	// });

</script>

<style lang="less">
	@import '_base.less';


	.pfp-gen {
		.font(huge, @size: 30px);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 20%;
		outline: 1px solid var(--theme-color-primary);
		background: radial-gradient(ellipse farthest-side at bottom right, #07080a, #0f1317);
	}
</style>


<Screen nav slides>
	<Header pops search network account />

	{#if !g_contact}
		Loading contact...
	{:else}
		<Portrait
			resource={g_contact}
			resourcePath={p_contact}
			actions={gc_actions}
		>
			<svelte:fragment slot="subtitle">
				<Address copyable address={Chains.transformBech32(g_contact.address, $yw_chain)} />
			</svelte:fragment>address
		</Portrait>
<!-- 
		<TxnList
			context={TxnContext.CONTACT}
			txns={a_txns}
		/> -->
	<!-- 
		<div class="txns no-margin">
			{#if !a_txns.length}
				<div>
					No transactions yet
				</div>
			{/if}

			{#each a_txns as k_txn}
				{@const gd_txn = k_txn.def}
				{@const k_token = H_ADDRESS_TO_TOKEN[k_txn.def.address]}
				{@const g_bankish = k_txn.bankish($yw_account.address($yw_chain))}
				{@const a_debug = [g_bankish, k_txn]}
				</!-- {@debug a_debug} --/>

				{#if Txn.Type.RECV === gd_txn.type}
					<Row
						name="Received SCRT"
					>
					</Row>
					</!-- approx(gd_txn.amount) --/>
				{:else if Txn.Type.SEND === gd_txn.type}
					<Row
						name="Sent SCRT"
					>
					</Row>
				{/if}
			{/each}
		</div> -->
	{/if}

</Screen>