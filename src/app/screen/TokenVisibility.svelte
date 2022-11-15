<script lang="ts">
	import type {AppStruct, AppPath} from '#/meta/app';
	import type {Promisable} from '#/meta/belt';
	import type {ChainStruct, ChainPath, ContractStruct} from '#/meta/chain';
	import type {FieldConfig} from '#/meta/field';
	import type {SecretStruct} from '#/meta/secret';
	
	import {Snip2xMessageConstructor, Snip2xToken} from '#/schema/snip-2x-const';
	
	import {Screen, Header} from './_screens';
	import {syserr} from '../common';
	import {yw_account, yw_account_ref, yw_network, yw_owner} from '../mem';
	import {load_page_context} from '../svelte';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {Apps, G_APP_STARSHELL} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Secrets} from '#/store/secrets';
	
	import QueryPermitCreate from './QueryPermitCreate.svelte';
	import RequestSignature from './RequestSignature.svelte';
	import ChainToken from '../frag/ChainToken.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Field from '../ui/Field.svelte';
	import Fields from '../ui/Fields.svelte';
	import PasswordField from '../ui/PasswordField.svelte';
	import QueryPermitRow from '../frag/QueryPermitRow.svelte';
	import Row from '../ui/Row.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	
	const {
		k_page,
	} = load_page_context();

	export let contract: ContractStruct;

	let g_chain: ChainStruct;
	let p_chain: ChainPath;

	const g_snip20 = contract.interfaces.snip20!;

	let k_token = new Snip2xToken(contract, $yw_network as SecretNetwork, $yw_account);

	const s_header_title: Promisable<string> = `SNIP-20`;
	const s_header_post_title: Promisable<string> = 'Visibility';
	const s_header_subtitle: Promisable<string> = `${contract.name} token`;

	const a_fields: FieldConfig[] = [];

	let s_viewing_key = '';
	let g_viewing_key: SecretStruct<'viewing_key'>;
	let a_outlets_vks: AppStruct[] = [];

	let a_permits: SecretStruct<'query_permit'>[] = [];
	let s_permit_title = '';

	(async() => {
		g_chain = (await Chains.at(contract.chain))!;
		p_chain = Chains.pathFrom(g_chain);

		const a_viewing_key = await k_token.viewingKey();
		if(!a_viewing_key) {
			throw syserr({
				title: 'No Viewing Key',
				text: 'You seem to be missing a viewing key for this token.',
			});
		}

		[s_viewing_key, g_viewing_key] = a_viewing_key;

		a_permits = await Secrets.filter({
			type: 'query_permit',
			owner: $yw_owner,
			contracts: {
				[contract.bech32]: '',
			},
			chain: p_chain,
		});

		const as_apps = new Set<AppPath>();
		for(const g_permit of a_permits) {
			for(const p_app of g_permit.outlets) {
				as_apps.add(p_app);
			}
		}

		if(!a_permits.length) {
			s_permit_title = 'No query permits yet';
		}
		else {
			s_permit_title = `${a_permits.length} permit${1 === a_permits.length? ' grants': 's grant'} ${as_apps.size} app${1 === as_apps.size? '': 's'} some query permissions`;
		}

		const ks_apps = await Apps.read();
		a_outlets_vks = await Promise.all(g_viewing_key.outlets.map(p => ks_apps.at(p)));
	})();

	async function rotate_key() {
		// construct viewing key message
		const g_exec = await Snip2xMessageConstructor.generate_viewing_key($yw_account, contract, $yw_network as SecretNetwork, s_viewing_key);

		k_page.push({
			creator: RequestSignature,
			props: {
				protoMsgs: [g_exec.proto],
				fee: {
					limit: BigInt(g_chain.features.secretwasm!.snip20GasLimits.set_viewing_key),
				},
				broadcast: {},
				local: true,
			},
			context: {
				app: G_APP_STARSHELL,
				chain: g_chain,
				accountPath: $yw_account_ref,
				// async completed(b_answer: boolean, g_completed: CompletedSignature) {
				// },
			},
		});
	}

	const H_INTERFACES = {
		snip20: {
			title: 'SNIP-20',
			label: 'Fungible Token',
			checked: true,
			disabled: true,
		},
		snip21: {
			title: 'SNIP-21',
			label: 'Improved SNIP-20',
			checked: !!contract.interfaces.snip21,
			disabled: true,
		},
		snip22: {
			title: 'SNIP-22',
			label: 'Batch Operations',
			checked: !!contract.interfaces.snip22,
			disabled: true,
		},
		snip23: {
			title: 'SNIP-23',
			label: 'Enhanced Send',
			checked: !!contract.interfaces.snip23,
			disabled: true,
		},
		snip24: {
			title: 'SNIP-24',
			label: 'Query Permits',
			checked: !!contract.interfaces.snip24,
			disabled: true,
		},
	};

	let b_tooltip_showing = false;
</script>


<Screen nav slides>
	<Header pops search account
		title={s_header_title}
		postTitle={s_header_post_title}
		subtitle={s_header_subtitle}
	/>

	<h3 style="position:relative; z-index:16;">
		Visibility Settings
		<Tooltip bind:showing={b_tooltip_showing}>
			<p>
				SNIP-20 tokens are private, meaning that only certain agents are able to view an account's balance and transaction history.
				This screen lets you control the visibility of this token.
			</p>
		</Tooltip>
	</h3>


	<ChainToken contract={contract} />

	<PasswordField password={s_viewing_key} label="Viewing Key">
		<svelte:fragment slot="right">
			<button class="pill" on:click={() => rotate_key()}>
				Rotate Key
			</button>
		</svelte:fragment>
	</PasswordField>

	<Field key="apps-vks" name="Apps with Viewing Key">
		<div>
			{0 === a_outlets_vks.length? 'No': a_outlets_vks.length} app{1 === a_outlets_vks.length? ' has': 's have'} this viewing key
		</div>

		{#each a_outlets_vks as g_outlet}
			<Row
				resource={g_outlet}
			/>
		{/each}
	</Field>

	<Field key="permits" name="Query Permits">
		<svelte:fragment slot="right">
			{#if contract.interfaces.snip24}
				<button class="pill" on:click={() => k_page.push({
					creator: QueryPermitCreate,
					props: {
						contract,
					},
				})}>
					Create Permit
				</button>
			{/if}
		</svelte:fragment>

		{#if contract.interfaces.snip24}
			{s_permit_title}

			{#each a_outlets_vks as g_outlet}
				<Row
					resource={g_outlet}
				/>
			{/each}

			{#each a_permits as g_permit}
				<QueryPermitRow secret={g_permit} />
			{/each}
		{:else}
			This token does not support query permits
		{/if}
	</Field>

<!-- 
	<Field key="interfaces" name="Contract Interfaces">
		{#each ode(H_INTERFACES) as [si_interface, g_interface]}
			<div class="interface-option">
				<CheckboxField id={si_interface}
					checked={!!g_interface['checked']}
					disabled={!!g_interface['disabled']}
					rootStyle={`
						margin: 1em 0;
						display: inline-flex;
					`}
				>
					<span class="title" style="min-width:6.5ch;">
						{g_interface.title}
					</span>
					<span class="label" style="color:var(--theme-color-text-med);">
						- {g_interface.label}
					</span>
				</CheckboxField>
			</div>
		{/each}
	</Field> -->

	<Fields configs={a_fields} />

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>
