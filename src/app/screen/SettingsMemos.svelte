<script lang="ts">
	import {Chains} from '#/store/chains';
	import {getContext} from 'svelte';
	import type {Intent} from '../svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Header from '../ui/Header.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	import Toggle from '@solar-republic/svelte-toggle';
	import {Screen, type Page} from './_screens';
	import type {ChainInterface, ChainPath} from '#/meta/chain';
	import {Settings, type SettingsRegistry} from '#/store/settings';
	import {yw_account, yw_owner} from '../mem';
	import {syserr} from '../common';
	import {
		type ActiveNetwork,
		Networks,
		UnpublishedAccountError,
	} from '#/store/networks';

	const k_page = getContext<Page>('page');
	const g_intent = getContext<Intent | null>('intent') || null;

	// whether the settings are busy being adjusted
	let b_busy = false;

	// cached memo settings
	let h_settings: NonNullable<SettingsRegistry['e2e_encrypted_memos']> = {};
	(async function load() {
		h_settings = await Settings.get('e2e_encrypted_memos') || {};
	})();

	async function toggle_chain(p_chain: ChainPath, g_chain: ChainInterface, b_state: boolean) {
		// do not apply if busy
		if(b_busy) return;

		// set toggle as busy
		b_busy = true;

		// refetch memo setting per chain
		h_settings = await Settings.get('e2e_encrypted_memos') || {};

		// setting does not yet exist for chain; initialize
		if(!h_settings[p_chain]) {
			h_settings[p_chain] = {
				enabled: false,
				published: false,
			};
		}

		// ref context
		const g_setting = h_settings[p_chain];

		// update enabled state
		g_setting.enabled = b_state;

		// enabling
		if(b_state) {
			// check if user is published
			try {
				// create network provider
				const ks_networks = await Networks.read();
				let k_network: ActiveNetwork | undefined;
				for(const [p_network, g_network] of ks_networks.entries()) {
					const p_chain_test = g_network.chain;
					if(p_chain === p_chain_test) {
						k_network = Networks.activate(g_network, g_chain);
						break;
					}
				}

				if(!k_network) {
					throw new Error(`No network provider found for ${p_chain}`);
				}

				// lookup account
				await k_network.e2eInfoFor($yw_owner);

				// set published status
				g_setting.published = true;
			}
			catch(e_info) {
				// update setting
				g_setting.enabled = g_setting.published = false;

				// unpublished account
				if(e_info instanceof UnpublishedAccountError) {
					syserr({
						title: 'Account Unpublished',
						text: `In order to enable private memos on ${g_chain.name}, you must first send at least one transaction.`,
					});
				}
				// other
				else {
					syserr({
						title: e_info.constructor.name,
						error: e_info,
					});
				}
			}
		}

		// update entry
		await Settings.set('e2e_encrypted_memos', h_settings);

		h_settings = h_settings;

		queueMicrotask(() => {
			b_busy = false;
		});
	}
</script>

<style lang="less">
	
</style>

<Screen
	debug='SettingsMemos'
>
	<Header
		plain
		pops
		account
		title='Settings'
		subtitle='Memos'
	></Header>

	<h3>Private Memos for {$yw_account.name}</h3>

	<div class="rows no-margin">
		{#await Chains.read()}
			<LoadingRows count={5} />
		{:then ks_chains}
			{#each ks_chains.entries() as [p_chain, g_chain]}
				<Row
					resource={g_chain}
					resourcePath={p_chain}
				>
					<svelte:fragment slot="right">
						<Toggle size={20}
							on="On" off="Off"
							disabled={b_busy}
							toggled={h_settings[p_chain]?.enabled && h_settings[p_chain]?.published}
							on:toggle={d_event => toggle_chain(p_chain, g_chain, d_event.detail)}
						/>
					</svelte:fragment>
				</Row>
			{/each}
		{/await}
	</div>

	{#if g_intent}
		<ActionsLine confirm={['Done', () => k_page.pop(), b_busy]} />
	{/if}
</Screen>
