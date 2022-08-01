import BlankSvelte from './screen/Blank.svelte';
import RegisterSvelte from './screen/Register.svelte';
import HoldingsHomeSvelte from './screen/HoldingsHome.svelte';
import AccountHomeSvelte from './screen/AccountsHome.svelte';
import ContactsHomeSvelte from './screen/ContactsHome.svelte';
import SitesHomeSvelte from './screen/SitesHome.svelte';
import NetworksHomeSvelte from './screen/NetworksHome.svelte';
import HistoryHomeSvelte from './screen/HistoryHome.svelte';

export enum ThreadId {
	DEFAULT='default',
	INIT='init',
	SEARCH='search',
	TOKENS='tokens',
	NFTS='nfts',
	CONTACTS='contacts',
	HISTORY='history',
	NETWORKS='networks',
	ACCOUNTS='accounts',
	TAGS='tags',
	SITES='sites',
}

export const H_THREADS = {
	[ThreadId.DEFAULT]: BlankSvelte,
	[ThreadId.INIT]: RegisterSvelte,
	// [ThreadId.SEARCH]: Search,
	[ThreadId.TOKENS]: HoldingsHomeSvelte,
	// [ThreadId.NFTS]: Gallery,
	[ThreadId.CONTACTS]: ContactsHomeSvelte,
	[ThreadId.HISTORY]: HistoryHomeSvelte,
	[ThreadId.NETWORKS]: NetworksHomeSvelte,
	[ThreadId.ACCOUNTS]: AccountHomeSvelte,
	// // [ThreadId.Tags]: Tags,
	[ThreadId.SITES]: SitesHomeSvelte,
} as const;
