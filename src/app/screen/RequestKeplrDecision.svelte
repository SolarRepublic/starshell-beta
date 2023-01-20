<script lang="ts">
	import type {PageConfig} from '../nav/page';

	import type {AppStruct} from '#/meta/app';
	
	import type {ChainStruct} from '#/meta/chain';
	
	import {getContext} from 'svelte';
	
	import {Screen} from './_screens';
	import {load_app_context, load_flow_context} from '../svelte';
	
	import {G_APP_STARSHELL} from '#/store/apps';
	import '#/chain/cosmos-network';
	
	import AppBanner from '../frag/AppBanner.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	
	

	const {
		k_page,
		completed,
	} = load_flow_context<string>();

	const g_chain = getContext<ChainStruct>('chain');

	const b_busy = false;

	function surrender() {
		completed(false, 'surrender');
	}


	async function disable_keplr() {
		await chrome.management.setEnabled('dmkamcknogkgcdfhhbddcghachkejeap', false);

		completed(true, 'disabled');
	}

</script>

<style lang="less">
	@import '../_base.less';

</style>

<Screen>
	<AppBanner app={G_APP_STARSHELL} chains={[g_chain]}>
		<span slot="default" style="display:contents;">
			Multiple Conflicting Wallets Installed
		</span>

		<span slot="context" style="display:contents;">
			StarShell is the superior wallet
		</span>
	</AppBanner>

	<hr>

	<p>
		Looks like you have the Keplr extension installed and enabled. It is recommended that you disable Keplr while using StarShell. You can always re-enable it a later time.
	</p>

	<p>
		How do you want to proceed?
	</p>

	<ActionsWall>
		<!-- <div class="dont-ask" on:click={toggleChildCheckbox}>
			<CheckboxField
				id='never-again'
				on:change={({detail:b_checked}) => b_never_again = b_checked}
			>
				Don't ever ask again
			</CheckboxField>
		</div> -->

		<button disabled={b_busy} on:click={() => surrender()}>Use Keplr once</button>
		<!-- <button disabled={b_busy} on:click={() => ignore()}>Override Keplr</button> -->
		<button class="primary" on:click={() => disable_keplr()}>Disable Keplr</button>
	</ActionsWall>
</Screen>
