<script lang="ts">
	import { Screen, type Page } from './_screens';
	import { Vault } from '#/crypto/vault';

	import type { App } from '#/meta/app';
	import { Apps } from '#/store/apps';

	import { onMount} from 'svelte';
	import { P_PUBLIC_SUFFIX_LIST, R_DOMAIN_IP, R_DOMAIN_LOCALHOST } from '#/share/constants';
	import type { Completed } from '#/entry/flow';
	import { WebResourceCache } from '#/store/web-resource-cache';

	import '#/chain/main';

	
	export let k_page: Page;

	export let completed: Completed;

	export let app: App['interface'];
	const g_app = app;

	// derive path from app struct
	const p_app = Apps.pathFrom(g_app);

	// ref host
	const s_host = g_app.host;


	/*

	AppsStore.subscribe((ks_apps) => {
		const p_app = ks_apps.pathFor(g_app);

	*/

	let b_busy = false;

	async function allow(): Promise<1> {
		// do not interupt; lock
		if(b_busy) return 1; b_busy = true;

		// prep graceful exit
		const exit = (): 1 => (b_busy = false, 1);

		// save app def to storage
		await Apps.open(async(ks_apps) => {
			await ks_apps.put(ks_apps.at(p_app) || g_app);
		});

		// done
		completed(true);
		return exit();
	}

	async function parse_domain_parts(): Promise<string[]> {
		// fetch the cached suffix list
		const a_suffixes = await WebResourceCache.get(P_PUBLIC_SUFFIX_LIST);

		// prep etld
		let s_etld = '';

		// list of domains to consider for new user policy
		const a_domains: string[] = [];

		// localhost
		if(R_DOMAIN_LOCALHOST.test(s_host)) {
			// full domain
			a_domains.push(s_host);
		}
		// secure context
		else if('https' === g_app.scheme) {
			// full domain
			a_domains.push(s_host);

			// not an ip address
			if(!R_DOMAIN_IP.test(s_host)) {
				// extract port suffix if any
				const s_port_suffix = s_host.replace(/^.*(:.+)$/, '$1');

				// split hostname
				const a_subs = s_host.replace(/:.+$/, '').split('.');

				// each part of the domain
				for(let i_etld=a_subs.length-1; i_etld>0; i_etld--) {
					// create etld test
					const s_test = a_subs.slice(i_etld).join('.');

					// is a regsitered public suffix
					if(a_subs.includes(s_test)) {
						continue;
					}
					// reached the end of the etld
					else {
						s_etld = s_test;
						break;
					}
				}

				// org-level domain
				a_domains.push('*.'+s_etld+s_port_suffix);
			}
		}

		// answer
		return a_domains;
	}
</script>

<style lang="less">
	
</style>

<Screen>
	Allow {g_app.host} to see you have StarShell installed?

	{#await parse_domain_parts() then a_domains}
		{#each a_domains as s_pattern}
			<div>
				<input type="checkbox"> Always allow <code>{s_pattern}</code> to see StarShell.
			</div>
		{/each}
	{/await}

	<button disabled={b_busy} on:click={() => allow()}>Allow</button>
	<button disabled={b_busy} on:click={() => completed(false)}>Cancel</button>
</Screen>
