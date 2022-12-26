<script lang="ts">
	import {getContext} from 'svelte';
	
	import {Screen, SubHeader, type Page} from './_screens';
	
	import {yw_chain_ref, yw_network} from '../mem';
	
	import {W_FILTER_ACCEPT_ANY} from '#/store/_base';
	import {Apps} from '#/store/apps';
	import {open_external_link} from '#/util/dom';
	
	import AppView from './AppView.svelte';
	import InlineTags from '../frag/InlineTags.svelte';
	import Header from '../ui/Header.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	

	const k_page = getContext<Page>('page');

	async function load_apps() {
		// select all apps on current chain
		const a_apps = await Apps.filter({
			on: 1,
			connections: {
				[$yw_chain_ref]: W_FILTER_ACCEPT_ANY,
			},
		});

		return a_apps.reverse();
	}

	let c_updates = 0;
	yw_network.subscribe(() => c_updates++);
</script>

<style lang="less">
	
</style>

<Screen nav root debug='AppsHome' classNames="apps">
	<Header search network account />

	<SubHeader bare
		title='Apps'
	/>

	<div class="rows no-margin">
		{#key c_updates}
			{#await load_apps()}
				<LoadingRows count={3} />
			{:then a_apps} 
				{#each a_apps as [p_app, g_app]}
					<Row
						pfp={g_app.pfp}
						name={g_app.name}
						detail={g_app.host}
						resourcePath={p_app}
						iconClass={'square pfp'}
						on:click={() => {
							k_page.push({
								creator: AppView,
								props: {
									app: g_app,
								},
							});
						}}
					>
						<svelte:fragment slot="right">
							<button class="pill" on:click|stopPropagation={() => open_external_link(`${g_app.scheme}://${g_app.host}/`, {exitPwa:true})}>
								Launch
							</button>
						</svelte:fragment>

						<svelte:fragment slot="tags">
							<InlineTags subtle resourcePath={p_app} />
						</svelte:fragment>
					</Row>
				{/each}
			{/await}
		{/key}
	</div>
</Screen>