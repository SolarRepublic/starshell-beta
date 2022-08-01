<script lang="ts">	
	import Row from './Row.svelte';

	import { Icon } from "#/objects/icon";
	import type { Hash } from "#/util/types";
	import Pfp from "./Pfp.svelte";
	import { push_ref, push_screen, yw_cancel_search, yw_search } from "#/app";
	import AccountView from "#/screen/AccountView.svelte";
	import type { Account } from "#/objects/account";
	import ChainView from "#/screen/ChainView.svelte";
	import ContactView from "#/screen/ContactView.svelte";
	import type { Chain } from "#/objects/chain";
	import NetworkEdit from "#/screen/NetworkEdit.svelte";
	import NftView from "#/screen/NftView.svelte";
	import TokenHoldingView from "#/screen/TokenHoldingView.svelte";
	import type { Holding } from "#/objects/holding";
	import { ode } from "#/util/belt";
	import type { WisprUri } from "#/state/path";


	export let item: SearchItem;

	const p_item = item.iri;
	const si_class = item.class;

	let k_thing: Definable<SearchItem>;

	const H_CLASS_MAP = {
		[ClassType.ACCOUNT]: {
			things: H_ACCOUNTS,
			open() {
				push_screen(AccountView, {
					account: k_thing as Account,
				});
			},
		},
		[ClassType.CHAIN]: {
			things: H_CHAINS,
			open() {
				push_screen(ChainView, {
					chain: k_thing as Chain,
				});
			},
		},
		[ClassType.CONTACT]: {
			things: H_CONTACTS,
			open() {
				push_screen(ContactView, {
					contact: k_thing as Contact,
				});
			},
		},
		[ClassType.CONTRACT]: {
			things: H_CONTRACTS,
			open() {
				// push_screen(Contract, {

				// });
			},
		},
		[ClassType.NETWORK]: {
			things: H_NETWORKS,
			open() {
				push_screen(NetworkEdit, {
					network: k_thing as Network,
				});
			},
		},
		[ClassType.SNIP721]: {
			things: H_NFTS,
			open() {
				push_screen(NftView, {
					nft: k_thing as Nft,
				});
			},
		},
		[ClassType.SITE]: {
			things: H_SITES,
			open() {
				// push_screen(Site, {

				// });
			},
		},
		[ClassType.TOKEN]: {
			things: H_TOKENS,
			open() {
				const k_holding = Object.values(H_HOLDINGS).find(k_holding => p_item === k_holding.def.tokenRef);

				if(k_holding) {
					push_screen(TokenHoldingView, {
						holding: k_holding,
					});
				}
				// else {

				// }
			},
		},
	} as unknown as Hash<{
		things: Record<WisprUri, Definable<SearchItem>>;
		open: VoidFunction;
	}>;



	let gd_thing = null;
	const g_class = H_CLASS_MAP[si_class];
	const h_things = g_class.things;

	k_thing = h_things[p_item];
	if(h_things && k_thing) {
		gd_thing = k_thing.def;
	}

	const p_icon = gd_thing?.iconRef || '';
	const a_tags = gd_thing?.tagRefs || [];

	let s_name = item.label;
	switch(si_class) {
		case ClassType.SNIP721: {
			if(!s_name && gd_thing) {
				s_name = gd_thing.id;
			}
			break;
		}
	}

	function open() {
		$yw_search = '';
		$yw_cancel_search();
		g_class.open();
	}

</script>

<style lang="less">

</style>

<Row name={s_name} detail={item.detail} iconRef={p_icon} tagRefs={a_tags}
	on:click={() => open()}
>
	<svelte:fragment slot="icon">
		<Pfp name={item.label} iconRef={p_icon} circular={![ClassType.ACCOUNT, ClassType.CONTACT, ClassType.SITE, ClassType.SNIP721].includes(si_class)} />
	</svelte:fragment>
</Row>