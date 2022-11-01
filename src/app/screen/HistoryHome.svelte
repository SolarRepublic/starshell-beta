<script lang="ts">
	import {onDestroy} from 'svelte';
	
	import {
		Screen,
		Header,
		SubHeader,
	} from './_screens';
	
	import {global_receive} from '#/script/msg-global';
	import {Incidents} from '#/store/incidents';
	
	import IncidentsList from '../ui/IncidentsList.svelte';
	

	let c_reloads = 1;
	const f_unsubscribe = global_receive({
		updateStore({key:si_store}) {
			if('incidents' === si_store || 'histories' === si_store) {
				c_reloads++;
			}
		},
	});

	onDestroy(() => {
		f_unsubscribe();
	});

	async function load_incidents() {
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

	{#key c_reloads}
		{#await load_incidents()}
			Loading history...
		{:then a_incidents}
			<IncidentsList
				incidents={a_incidents}
			/>
		{/await}
	{/key}
</Screen>
