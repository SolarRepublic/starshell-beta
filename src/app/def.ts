import BlankSvelte from './screen/Blank.svelte';
import RegisterSvelte from './screen/Register.svelte';
import HoldingsHomeSvelte from './screen/HoldingsHome.svelte';
import AccountHomeSvelte from './screen/AccountsHome.svelte';
import ContactsHomeSvelte from './screen/ContactsHome.svelte';
import ProvidersHomeSvelte from './screen/ProvidersHome.svelte';
import HistoryHomeSvelte from './screen/HistoryHome.svelte';
import AppsHomeSvelte from './screen/AppsHome.svelte';

export enum ThreadId {
	DEFAULT='default',
	INIT='init',
	SEARCH='search',
	TOKENS='tokens',
	NFTS='nfts',
	CONTACTS='contacts',
	HISTORY='history',
	PROVIDERS='providers',
	ACCOUNTS='accounts',

	/**
	 * Used for misc things like QR scanner
	 */
	SCRATCH='scratch',

	APPS='apps',
	TAGS='tags',
}

export const H_THREADS = {
	[ThreadId.DEFAULT]: BlankSvelte,
	[ThreadId.INIT]: RegisterSvelte,
	// [ThreadId.SEARCH]: Search,
	[ThreadId.TOKENS]: HoldingsHomeSvelte,
	// [ThreadId.NFTS]: Gallery,
	[ThreadId.CONTACTS]: ContactsHomeSvelte,
	[ThreadId.HISTORY]: HistoryHomeSvelte,
	[ThreadId.PROVIDERS]: ProvidersHomeSvelte,
	[ThreadId.ACCOUNTS]: AccountHomeSvelte,
	// // [ThreadId.Tags]: Tags,
	[ThreadId.APPS]: AppsHomeSvelte,
	[ThreadId.SCRATCH]: BlankSvelte,
} as const;
