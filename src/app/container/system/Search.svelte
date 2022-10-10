<script context="module" type="ts">	
	export enum ClassType {
		UNKNOWN = 'unknown',

		// set of chains which share a common address space, such that user accounts are translatable across members
		FAMILY = 'family',

		// specific blockchain
		CHAIN = 'chain',

		// configuration for how to communicate with chain
		PROVIDER = 'provider',

		// 
		ACCOUNT = 'account',

		// pubkey associated with distinct family 'member'
		CONTACT = 'contact',

		// on-chain resource that only exists this chain
		CONTRACT = 'contract',

		// addressable asset associated with distinct chain
		TOKEN = 'token',

		// asset holdings
		HOLDING = 'holding',

		// app connection
		APP = 'app',

		// native coin
		COIN = 'coin',

		TAG = 'tag',
		ICON = 'icon',

		IBCT = 'ibct',
		SNIP721 = 'snip721',
		TXN = 'txn',
		OTHER = 'other',
	}

	export interface SearchItem {
		class: ClassType;
		resourcePath: Resource.Path;
		name: string;
		resource: Resource['interface'];
		details: Dict<JsonValue>;
	}

	export interface SearchGroup {
		source: Promisable<typeof WritableStoreMap & StaticStore | Array<any>>;
		transform(g_thing: Resource['interface']): Omit<SearchItem, 'ref'>;
		keys: string[];
	}
</script>

<script type="ts">
	import Fuse from 'fuse.js';

	import {
		yw_cancel_search,
		yw_header_props,
		yw_search,
	} from '##/mem';

	import {
		Screen,
		Header,
	} from '##/screen/_screens';

	// import GenericRow from '#/ui/GenericRow.svelte';
	import {Accounts} from '#/store/accounts';
	import {Agents} from '#/store/agents';
	import {Apps} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Entities} from '#/store/entities';
	import type {Resource} from '#/meta/resource';

	import {ode, oderac, proper} from '#/util/belt';
	import type {StaticStore, WritableStoreMap} from '#/store/_base';
	import Row from '#/app/ui/Row.svelte';
	import type {Dict, JsonValue, Promisable} from '#/meta/belt';

	let dm_results: HTMLElement;
	const a_results: SearchItem[] = [];


	// let y_fuse: Fuse<SearchItem>;
	let a_fuses: Fuse<SearchItem>[] = [];

	const fuzey = (a_items: SearchItem[], a_keys: string[]) => new Fuse(a_items, {
		includeScore: true,
		includeMatches: true,
		keys: [
			'label',
			...a_keys.map(s => `details.${s}`),
		],
	});

	(async() => {
		const h_stores = {};

		const ks_chains = await Chains.read();

		a_fuses = [
			// chains
			(() => fuzey(ks_chains.entries().map(([p_chain, g_chain]) => ({
				class: ClassType.CHAIN,
				name: g_chain.name,
				resourcePath: p_chain,
				resource: g_chain,
				details: {
					name: g_chain.name,
					id: g_chain.reference,
				},
			})), ['id']))(),

			// coins
			(() => fuzey(ks_chains.entries().flatMap(([p_chain, g_chain]) => oderac(g_chain.coins, (si_coin, g_coin) => ({
				class: ClassType.COIN,
				name: proper(g_coin.extra?.coingecko_id || 'Unknown'),
				postname: si_coin,
				resourcePath: `${p_chain}/coin.${si_coin}`,
				resource: {
					...g_coin,
					name: g_coin.name || proper(g_coin.extra?.coingecko_id || 'Unknown'),
					pfp: g_coin.pfp || g_chain.pfp,
				},
				details: {
					symbol: si_coin,
					denom: g_coin.denom,
					coingecko: g_coin.extra?.coingecko_id || '',
				},
			}))), ['symbol', 'denom']))(),

			...await Promise.all([
				// accounts
				(async() => {
					const ks_accounts = await Accounts.read();

					return fuzey(ks_accounts.entries().map(([p_account, g_account]) => {
						const a_addrs: string[] = [];
						const as_addrs = new Set<string>();

						for(const [, g_chain] of ks_chains) {
							as_addrs.add(Chains.addressFor(g_account.pubkey, g_chain));
						}

						a_addrs.push(...as_addrs);

						return {
							class: ClassType.ACCOUNT,
							name: g_account.name,
							resourcePath: p_account,
							resource: g_account,
							details: {
								name: g_account.name,
								addresses: a_addrs,
							},
						};
					}), ['addresses']);
				})(),

				// contacts
				(async() => {
					const ks_agents = await Agents.read();

					return fuzey([...ks_agents.contacts()].map(([p_contact, g_contact]) => ({
						class: ClassType.CONTACT,
						name: g_contact.name,
						resourcePath: p_contact,
						resource: g_contact,
						details: {
							name: g_contact.name,
							notes: g_contact.notes,
							addresses: [...ks_chains.inNamespace(g_contact.namespace)]
								.map(([, g_chain]) => Agents.addressFor(g_contact, g_chain)),
						},
					})), ['notes']);
				})(),

				// apps
				(async() => {
					const ks_apps = await Apps.read();

					return fuzey(ks_apps.entries().map(([p_app, g_app]) => ({
						class: ClassType.APP,
						name: g_app.host,
						resourcePath: p_app,
						resource: g_app,
						details: {
							host: g_app.host,
						},
					})), []);
				})(),

				// tokens
				(async() => {
					const a_tokens: SearchItem[] = [];

					for(const [, g_chain] of ks_chains.entries()) {
						for(const [si_spec, h_tokens] of ode(await Entities.readFungibleTokens(g_chain))) {
							for(const [p_token, g_token] of ode(h_tokens)) {
								a_tokens.push({
									class: ClassType.TOKEN,
									name: g_token.name,
									resourcePath: p_token,
									resource: g_token,
									details: {
										spec: si_spec,
										name: g_token.name,
										symbol: g_token.symbol,
										bech32: g_token.bech32,
										codehash: g_token.hash,
									},
								});
							}
						}
					}

					return fuzey(a_tokens, [
						'spec',
						'symbol',
						'bech32',
						'codehash',
					]);
				})(),

				// Entities,
				// Providers,
			]),
		];
	})();

	function search(s_search: string) {
		const a_groups: {top: number; hits: Fuse.FuseResult<SearchItem>[]}[] = [];
		const a_hits: Fuse.FuseResult<SearchItem>[] = [];
		let c_total = 0;

		for(const y_fuse of a_fuses) {
			const a_hits_local = y_fuse.search(s_search);

			if(a_hits_local.length) {
				c_total += a_hits.length;

				a_hits.push(...a_hits_local);

				a_groups.push({
					top: a_hits_local[0].score!,
					hits: a_hits_local,
				});
			}
		}

		// sort all hits
		a_hits.sort((g_a, g_b) => g_b.score! - g_a.score!);

		// clear results list
		dm_results.innerHTML = '';

		console.log(a_hits);

	
		for(const g_hit of a_hits)	{
			new Row({
				target: dm_results,
				props: {
					...g_hit.item,
					pfpDim: 32,
				},
			});
		}
	}

	$: {
		if($yw_search) {
			search($yw_search);
		}
	}

	// onMount(() => {
	// 	search($yw_search);
	// });
</script>

<style lang="less">
	.search {
		position: absolute;
		top: 0;
		left: 0;
		height: 100%;
		width: 100%;
		z-index: 1000;

		.results {

		}
	}
</style>


<div class="search" class:display_none={!$yw_search}>
	<Screen debug='Search' root>
		<Header network account search
			isSearchScreen {...($yw_header_props || {})} on:search={d_event => search(d_event.detail)}
		/>

		<p style='font-size:12px'>
			<span style='color:var(--theme-color-caution);'>Disclaimer: </span>
			This temporary search interface does not represent the look and function of the actual search interface currently under development for beta.
		</p>

		<div class="results no-margin" bind:this={dm_results}>
			{#key a_results}
				{#each a_results as g_result}
					<GenericRow item={g_result} />
				{/each}
			{/key}
		</div>
	</Screen>
</div>
