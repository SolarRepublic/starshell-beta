<script lang="ts">
	import type {AppStruct} from '#/meta/app';
	
	import {Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {Apps} from '#/store/apps';
	
	import IncidentsList from '../frag/IncidentsList.svelte';
	import Portrait, {type Actions} from '../frag/Portrait.svelte';
	import Header from '../ui/Header.svelte';
	

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
			Object.assign(h_actions, {
				disconnect: {
					async trigger() {
						// update the app
						await Apps.open(ks => ks.put({
							...ks.at(Apps.pathFrom(g_app))!,
							on: 0,
						}));

						// reload the actions
						reload_actions();
					},
				},
			});
		}
		else {
			Object.assign(h_actions, {
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

	reload_actions();

</script>

<style lang="less">
	
</style>

<Screen>
	<Header account network pops
		title='App Info'
	/>

	<Portrait
		actions={h_actions}
		resource={g_app}
		title={g_app.name}
		subtitle={g_app.host}
		resourcePath={Apps.pathFrom(g_app)}
	>

	</Portrait>

	<IncidentsList filterConfig={{app:p_app}} />
</Screen>
