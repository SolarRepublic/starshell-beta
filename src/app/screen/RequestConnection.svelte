<script lang="ts">
	import { Screen, Header, type Page } from './_screens';

	import type { Completed } from '#/entry/flow';
	import type { App } from '#/meta/app';
	import type { ChainDescriptor } from '#/script/common';
	import Banner from '../ui/Banner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import RequestConnectionPermissions from './RequestConnection_Permissions.svelte';
	import { getContext } from 'svelte';

	const completed = getContext<Completed>('completed');

	const g_app = getContext<App['interface']>('app');
	const p_favicon = getContext<string>('faviconSrc');

	// `data:image/png;base64,${sx_png}`

	const a_chains = getContext<ChainDescriptor[]>('chains');
	const i_chain = getContext<number>('chainIndex') || 0;
	const g_chain = a_chains[i_chain];

	// selected accounts to apply the connection to
	let a_accounts = [];
</script>

<Screen>
	<Banner display={{
		image: p_favicon,
		text: g_app.host,
	}} />

	<center>
		<h3>
			Connect to StarShell
		</h3>

		<h4>
			Select account(s)
		</h4>
	</center>

	<!-- <Rows -->

	<ActionsLine cancel={() => completed(false)} contd={{
		creator: RequestConnectionPermissions,
		props: {
			accounts: a_accounts,
		},
	}} />
</Screen>
