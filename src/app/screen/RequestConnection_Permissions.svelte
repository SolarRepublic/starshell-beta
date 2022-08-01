<script lang="ts">
	import { Screen, Header, type Page } from './_screens';

	import type { Completed } from '#/entry/flow';
	import type { App } from '#/meta/app';
	import type { ChainDescriptor } from '#/script/common';
	import Banner from '../ui/Banner.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
import { getContext } from 'svelte';


	const completed = getContext<Completed>('completed');

	const p_favicon = getContext<string>('faviconSrc');
	const g_app = getContext<App['interface']>('app');

	const a_chains = getContext<ChainDescriptor[]>('chains');

	function connect() {
		completed(true);
	}
</script>

<Screen>
	<Banner exits display={{
		image: p_favicon,
		text: g_app.host,
	}} />

	<center>
		<h3>
			Review permissions
		</h3>

		<h4>
			Allow this site to:
		</h4>
	</center>

	

	<ActionsLine back confirm={['Connect', connect]} />
</Screen>
