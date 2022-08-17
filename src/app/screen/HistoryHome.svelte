<script lang="ts">
	import { global_receive } from '#/script/msg-global';

	import {Incidents} from '#/store/incidents';
	import { onDestroy } from 'svelte';
import { yw_account, yw_network_active, yw_owner } from '../mem';
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

	async function load_incidents() {
		await $yw_network_active.synchronizeAll($yw_owner);

		const a_incidents = [...await Incidents.filter()];

		return a_incidents;
	}
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
		{#await load_incidents()}
			Loading history...
		{:then a_incidents}
			<TxnList
				incidents={a_incidents}
			/>
		{/await}
	{/key}
</Screen>
