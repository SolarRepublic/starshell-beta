<script context="module" lang="ts">

</script>

<script lang="ts">
	import type { Completed, Page } from "#/entry/flow";

	import type { Vocab } from "#/meta/vocab";
	import type { IntraExt } from "#/script/messages";
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import { runtime } from "webextension-polyfill";

	export let page: Page;
	export let completed: Completed;

	const {
		tabId: i_tab,
		href: p_href,
	} = page;

	const {
		host: s_host,
		hostname: s_hostname,
	} = new URL(p_href);

	async function reload_page() {
		// reload the tab
		await chrome.tabs.reload(i_tab);

		// callback
		completed(true);
	}
</script>

<style lang="less">
	
</style>

<div>
	Ready to reload the page from {s_host} to allow it to request connection?

	{#await chrome.tabs.get(i_tab) then g_tab}
		<iframe title="favicon frame" sandbox="">
			<img alt="favicon from {s_hostname}" src="{g_tab.favIconUrl}">
		</iframe>
	{/await}

	<button on:click={() => reload_page()}>Reload</button>
	<button on:click={() => completed(false)}>Cancel</button>
</div>
