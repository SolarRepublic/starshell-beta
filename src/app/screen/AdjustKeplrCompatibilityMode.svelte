<script lang="ts">
	import type {App, AppStruct} from '#/meta/app';
	import type {PageConfig} from '../nav/page';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import AppBanner from '../ui/AppBanner.svelte';
	import {Screen} from './_screens';
	import {Policies} from '#/store/policies';
	import {keplr_polyfill_script_add_matches, set_keplr_compatibility_mode, set_keplr_detection, set_keplr_polyfill} from '#/script/scripts';
	import {Apps} from '#/store/apps';
	import {load_flow_context} from '../svelte';

	const {
		k_page,
		completed,
	} = load_flow_context<undefined>();

	export let push: PageConfig | null;

	export let app: AppStruct;

	export let enable: boolean;

	async function enable_once(b_bypass_only=false) {
		// save app def to storage
		await Apps.add(app);

		// actually enable once
		if(!b_bypass_only) {
			// ensure polyfill is enabled for this app
			await keplr_polyfill_script_add_matches([Apps.scriptMatchPatternFrom(app)]);
		}

		// prompt user to reload 
		k_page.push(push!);
	}

	async function enable_everywhere() {
		// update setting
		await set_keplr_polyfill(true);

		// continue
		await enable_once(true);
	}

	async function disable_everywhere() {
		// TODO: consider impact on existing connections using keplr polyfill

		// do not inject window.keplr unconditionally anymore
		await set_keplr_polyfill(false);

		// disable keplr detection
		await set_keplr_detection(false);

		// disable compatibility mode
		await set_keplr_compatibility_mode(false);

		// complete
		ignore_once();
	}

	function ignore_once() {
		completed(false);
	}

	async function block_site() {
		// add policy to block app
		await Policies.blockApp(app);

		// complete
		ignore_once();
	}
</script>

<style lang="less">
	@import './_base.less';

	p {
		color: var(--theme-color-text-med);

		b {
			color: var(--theme-color-text-light);
			font-weight: 500;
		}
	}
</style>

<Screen>
	{#if enable}
		<h3>Are you sure you want to permanently enable Keplr compatibility mode?</h3>

		<hr>

		<p>
			Permanently enabling this feature means websites will be able to detect you have a Keplr-compatible wallet installed.
		</p>

		<p>
			Any website you visit can collect this data, build a profile of you and your interest in Cosmos blockchains, and possibly sell that to third parties.
		</p>

		<p>
			In the interest of privacy, <b>StarShell recommends selecting "Enable Once"</b>,
			so that you can review this prompt once for each website.
		</p>

		<ActionsWall>
			<button on:click={() => enable_once()}>Enable Once</button>
			<button class="primary" on:click={() => enable_everywhere()}>Enable Everywhere</button>
		</ActionsWall>
	{:else}
		<AppBanner {app} on:close={() => completed(false)} />

		<h3>Do you want to ignore, block this site, or disable Keplr compatibility mode?</h3>

		<p>
			Blocking this site will continue to hide the wallet from <code>{app.host}</code> and will not prompt you again.
		</p>

		<p>
			Permanently disabling this feature means that all websites will not be able to connect to your wallet using the Keplr API.
		</p>

		<ActionsWall>
			<style lang="less">
				.line {
					display: flex;
					justify-content: space-between;
					gap: var(--ui-padding);

					>* {
						flex: 1;
					}
				}
			</style>

			<div class="line">
				<button on:click={() => ignore_once()}>Ignore Once</button>
				<button class="cautionary" on:click={() => disable_everywhere()}>Disable Everywhere</button>
			</div>

			<button class="primary" on:click={() => block_site()}>Block Site</button>
		</ActionsWall>
	{/if}
</Screen>
