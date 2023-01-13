<script lang="ts">
	import type {Promisable} from '#/meta/belt';
	import type {Bech32} from '#/meta/chain';
	import type {ParametricSvelteConstructor} from '#/meta/svelte';
	
	import {yw_account, yw_chain, yw_network, yw_owner} from '../mem';
	import {Screen, Header} from '../screen/_screens';
	
	import {request_feegrant} from '../svelte';
	
	import {FeeGrants} from '#/chain/fee-grant';
	import {address_to_name} from '#/chain/messages/_util';
	import {ode} from '#/util/belt';
	
	import {format_amount, format_date_long} from '#/util/format';
	
	import ChainAccount from './ChainAccount.svelte';
	import Row from '../ui/Row.svelte';
	

	let a_grants: ParametricSvelteConstructor.Parts<ParametricSvelteConstructor<Row>>['params']['$$prop_def'][] = [];

	let b_loading = true;

	async function reload() {
		b_loading = true;
		a_grants = [];

		const k_fee_grants = await FeeGrants.forAccount($yw_account, $yw_network);

		for(const [si_coin, g_struct] of ode(k_fee_grants.grants)) {
			for(const g_grant of g_struct.grants) {
				a_grants.push({
					name: `${format_amount(g_grant.amount.toNumber())} ${si_coin} from ${await address_to_name(g_grant.allowance.granter as Bech32, $yw_chain)}`,
					detail: Number.isFinite(g_grant.expiration)
						? `Automatically expires ${format_date_long(g_grant.expiration)}`
						: 'No expiration set',
					pfp: $yw_chain.pfp,
				});
			}
		}

		b_loading = false;
		a_grants = a_grants;
	}

	function skip_init(f_callback: () => Promisable<void>) {
		let c_calls = 0;
		return function() {
			if(c_calls++) void f_callback();
		};
	}

	yw_account.subscribe(skip_init(reload));
	yw_network.subscribe(skip_init(reload));

	void reload();

	let b_requesting_feegrant = false;
	async function do_request_feegrant() {
		b_requesting_feegrant = true;

		await request_feegrant($yw_owner!);

		b_requesting_feegrant = false;
	}
</script>

<style lang="less">
	.rows {
		margin-top: 0.5em;
	}
</style>

<Screen>
	<Header pops network account
		title='What are Allowances?'
	/>

	<p>
		"Fee Grant" is a Cosmos feature that lets you spend coins from other accounts when paying gas fees.
	</p>

	<p>
		Allowances can be used to help new users or satellite accounts pay for initial gas fees.
	</p>

	<div>
		<p>
			Current allowances for:
		</p>

		<ChainAccount g_chain={$yw_chain} g_account={$yw_account} sx_root_style='margin-bottom:1em;' />

		{#if b_loading}
			<p>
				Checking for allowances...
			</p>
		{:else}
			{#if a_grants.length}
				<div class="rows">
					{#each a_grants as g_grant}
						<Row {...g_grant} noHorizontalPad />
					{/each}
				</div>
			{:else}
				<p>
					No allowances currently granted to {$yw_account.name}.
				</p>

				{#if Object.keys($yw_chain.mainnet?.feegrants || {}).length}
					<center>
						<button class="pill" disabled={b_requesting_feegrant} on:click={do_request_feegrant}>
							{#if b_requesting_feegrant}
								Requesting...
							{:else}
								Request fee allowance
							{/if}
						</button>
					</center>
				{/if}
			{/if}
		{/if}
	</div>
</Screen>
