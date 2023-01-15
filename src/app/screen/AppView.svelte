<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	
	import type {SecretStruct} from '#/meta/secret';
	
	import {onDestroy} from 'svelte';
	
	import {Screen} from './_screens';
	import {yw_account, yw_chain, yw_chain_ref, yw_owner} from '../mem';
	import {reloadable} from '../mem-store';
	import {load_page_context} from '../svelte';
	
	import {Apps} from '#/store/apps';
	
	import {Secrets} from '#/store/secrets';
	
	import AppDisconnect from './AppDisconnect.svelte';
	import AppViewingKeys from './AppViewingKeys.svelte';
	import IncidentsList from '../frag/IncidentsList.svelte';
	import Portrait, {type Actions} from '../frag/Portrait.svelte';
	import Gap from '../ui/Gap.svelte';
	import Header from '../ui/Header.svelte';
	
	
	
	import ResourceControl from '../ui/ResourceControl.svelte';
	
	import SX_ICON_CONFIRMATION from '#/icon/confirmation.svg?raw';
	import SX_ICON_EXPAND_RIGHT from '#/icon/expand-right.svg?raw';
	import SX_ICON_VISIBILITY from '#/icon/visibility.svg?raw';
	
	

	export let app: AppStruct;
	const g_app = app;

	const p_app = Apps.pathFrom(g_app);

	const {
		k_page,
	} = load_page_context();

	let h_actions: Actions = {};
	
	function reload_actions() {
		const h_stage = {
			permissions: {
				trigger() {
					// 
				},
			},

			accounts: {
				trigger() {
					//
				},
			},
		};

		if(g_app.on) {
			Object.assign(h_stage, {
				disconnect: {
					trigger() {
						k_page.push({
							creator: AppDisconnect,
							props: {
								g_app,
							},
						});

						// // update the app
						// await Apps.open(ks => ks.put({
						// 	...ks.at(Apps.pathFrom(g_app))!,
						// 	on: 0,
						// }));

						// // reload the actions
						// reload_actions();
					},
				},
			});
		}
		else {
			Object.assign(h_stage, {
				enable: {
					async trigger() {
						//
					},
				},

				delete: {
					async trigger() {
						// delete everything that touches the app
						// TODO: go thru incidents, secrets, contracts, ...

						// delete the app
						await Apps.open(ks => ks.delete(Apps.pathFrom(g_app)));

						// reset the thread
						k_page.reset();
					},
				},
			});
		}

		h_actions = h_stage;
	}


	let a_keys: SecretStruct<'viewing_key'>[] = [];
	let a_permits: SecretStruct<'query_permit'>[] = [];

	$: nl_keys = a_keys.length;
	$: nl_permits = a_permits.length;

	function edit_viewing_keys() {
		k_page.push({
			creator: AppViewingKeys,
			props: {
				g_app,
			},
		});
	}

	function edit_query_permits() {
		// k_page.push({
		// 	creator: AppQueryPermits,
		// 	props: {
		// 		g_app,
		// 	},
		// });
	}

	async function reload_access() {
		const p_chain = $yw_chain_ref;
		const sa_owner = $yw_owner!;

		[a_keys, a_permits] = await Promise.all([
			Secrets.filter({
				type: 'viewing_key',
				on: 1,
				owner: sa_owner,
				chain: p_chain,
				outlets: [p_app],
			}),

			Secrets.filter({
				type: 'query_permit',
				on: 1,
				owner: sa_owner,
				chain: p_chain,
				outlets: [p_app],
			}),
		]);
	}

	reload_actions();

	reloadable({
		context: {
			sources: [yw_chain, yw_account],
			action: reload_access,
		},
	}, onDestroy);

</script>

<style lang="less">
	
</style>

<Screen>
	<Header account network pops
		title='App Info'
		subtitle="on {$yw_chain.name}"
	/>

	<Portrait
		actions={h_actions}
		resource={g_app}
		title={g_app.name}
		subtitle={g_app.host}
		resourcePath={Apps.pathFrom(g_app)}
	>

	</Portrait>

	<div class="resource-controls">
		<ResourceControl
			infoIcon={SX_ICON_VISIBILITY}
			actionIcon={SX_ICON_EXPAND_RIGHT}
			on:click={edit_viewing_keys}
		>
			{nl_keys} viewing key{1 === nl_keys? '': 's'} shared with app
		</ResourceControl>		

		<ResourceControl
			infoIcon={SX_ICON_CONFIRMATION}
			actionIcon={SX_ICON_EXPAND_RIGHT}
			on:click={edit_query_permits}
		>
			{nl_permits} query permit{1 === nl_permits? '': 's'} in use
		</ResourceControl>
	</div>

	<Gap />

	<IncidentsList filterConfig={{app:p_app}} />
</Screen>
