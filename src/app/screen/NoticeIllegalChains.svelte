<script lang="ts">
	import {Screen} from './_screens';

	import type {AppInterface} from '#/meta/app';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import type {Caip2, ChainInterface} from '#/meta/chain';
	import {F_NOOP, ode} from '#/util/belt';
	import AppBanner from '../ui/AppBanner.svelte';
	import Row from '../ui/Row.svelte';
	import {load_flow_context} from '../svelte';

	const {
		completed,
	} = load_flow_context<undefined>();

	export let app: AppInterface;

	export let chains: Record<Caip2.String, ChainInterface>;

</script>

<style lang="less">

</style>

<Screen>
	<AppBanner {app} on:close={() => completed(false)}>
		<span slot="default" style="display:contents;">
			🚫 StarShell Beta does not allow<br>
			connecting to non-testnet chains
		</span>
		<span slot="context" style="display:contents;">
			Request testnet support by joining our discord
		</span>
	</AppBanner>

	<div class="rows no-margin">
		{#each ode(chains) as [si_caip2, g_chain]}
			<Row
				resource={g_chain}
				detail={si_caip2}
			>
			</Row>
		{/each}
	</div>

	<ActionsLine cancel={() => completed(true)} confirm={['Next', F_NOOP, true]} />
</Screen>
