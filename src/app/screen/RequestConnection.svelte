<script lang="ts">
	import {Screen} from './_screens';

	import type {AppInterface} from '#/meta/app';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import type {Caip2, ChainInterface} from '#/meta/chain';
	import type {SessionRequest} from '#/meta/api';
	import {fodemtv, F_NOOP, ode, oderom} from '#/util/belt';
	import type {Dict} from '#/meta/belt';
	import AppBanner from '../ui/AppBanner.svelte';
	import Row from '../ui/Row.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';
	import RequestConnectionAccounts from './RequestConnection_Accounts.svelte';
	import {load_flow_context} from '../svelte';

	const {
		completed,
	} = load_flow_context<undefined>();

	export let app: AppInterface;

	export let chains: Record<Caip2.String, ChainInterface>;
	const h_chains = chains;

	export let sessions: Dict<SessionRequest>;

	const nl_chains = Object.keys(h_chains).length;


	// selected state of each chain
	const h_selected = fodemtv(h_chains, () => true);

	$: b_none_selected = Object.values(h_selected).every(b => !b);

</script>

<style lang="less">

</style>

<Screen>
	<AppBanner {app} on:close={() => completed(false)}>
		This app wants to connect on {1 === nl_chains? 'the chain': `${nl_chains} chains`}:
	</AppBanner>


<!-- 
	{#if nl_chains > 2}
		<div class="select-all">
			<button class="pill">
				Select all
			</button>
		</div>
	{/if} -->

	<div class="rows no-margin">
		{#each ode(h_chains) as [si_caip2, g_chain]}
			<Row
				name={g_chain.name}
				pfp={g_chain.pfp}
				detail={si_caip2}
				on:click={toggleChildCheckbox}
			>
				<CheckboxField id={si_caip2} slot='right' checked={h_selected[si_caip2]}
					on:change={({detail:b_checked}) => h_selected[si_caip2] = b_checked} />
			</Row>
		{/each}
	</div>

	<ActionsLine cancel={() => completed(false)} confirm={['Next', F_NOOP, b_none_selected]} contd={{
		creator: RequestConnectionAccounts,
		props: {
			app,
			chains,
			sessions,
		},
	}} />
</Screen>
