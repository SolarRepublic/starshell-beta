<script lang="ts">
	import { Apps } from "#/store/apps";
	import { getContext } from "svelte";
	import Header from "../ui/Header.svelte";
	import Row from "../ui/Row.svelte";
	import { Page, Screen, SubHeader } from './_screens';

	const k_page = getContext<Page>('page');

	async function load_apps() {
		const ks_apps = await Apps.read();

		return ks_apps.entries();
	}
</script>

<style lang="less">
	
</style>

<Screen debug='SitesHome' nav root>
	<Header search network account />

	<SubHeader bare
		title='Sites / Apps'
	/>

	<div class="rows no-margin">
		{#await load_apps()}
			Loading...
		{:then a_apps} 
			{#each a_apps as [p_app, g_app]}
				<Row
					pfp={g_app.pfp}
					name={g_app.host}
					resourcePath={p_app}
					iconClass={'square pfp'}
					on:click={() => {
						k_page.push({
							// creator: SiteView,
						});
					}}
				>
				</Row>
			{/each}
		{/await}
	</div>
</Screen>