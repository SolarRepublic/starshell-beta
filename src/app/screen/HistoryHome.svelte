<script lang="ts">
	import { global_receive } from '#/script/msg-global';

	import { Events } from '#/store/events';
	import { onDestroy } from 'svelte';
	import { once_store_updates } from '../svelte';
	import TxnList from '../ui/TxnList.svelte';

	import {
		Screen,
		Header,
		SubHeader,
		type Page,
	} from './_screens';

	let c_reloads = 1;
	const f_unsubscribe = global_receive({
		updateStore({key:si_store}) {
			if('events' === si_store) {
				c_reloads++;
			}
		},
	});

	onDestroy(() => {
		f_unsubscribe();
	});
</script>

<style lang="less">
	@import './_base.less';

</style>

<Screen nav root
>
	<Header search network account
	>
		<svelte:fragment slot="title">

		</svelte:fragment>
	</Header>

	<SubHeader
		title='History'
		bare
	></SubHeader>

	<!-- 
	<p style='font-size:12px'>
		<span style='color:var(--theme-color-caution);'>Disclaimer: </span>
		This temporary history interface does not represent the look and function of the actual history interface currently under development for beta.
	</p> -->

	{#key c_reloads}
		{#await Events.read()}
			Loading history...
		{:then ks_events}
			{@const a_events = ks_events.raw}

			<TxnList
				events={a_events}
			/>
		{/await}
	{/key}
</Screen>
