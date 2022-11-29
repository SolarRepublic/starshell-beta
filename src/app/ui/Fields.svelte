<script type="ts">
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {AccountPath, AccountStruct} from '#/meta/account';
	import type {AppPath, AppStruct} from '#/meta/app';
	import type {Promisable} from '#/meta/belt';
	import type {Bech32, ChainStruct, ChainPath} from '#/meta/chain';
	import type {ContactStruct} from '#/meta/contact';
	import type {FieldConfig} from '#/meta/field';
	import type {Incident, TxSynced} from '#/meta/incident';
	
	import type {SecretPath} from '#/meta/secret';
	
	import {syserr} from '../common';
	import {classify} from '../helper/json-previewer';
	import {yw_chain} from '../mem';
	
	import {svelte_to_dom} from '../svelte';
	
	import {produce_contract} from '#/chain/contract';
	import type {CosmosNetwork} from '#/chain/cosmos-network';
	import {ecdh_nonce, extract_memo_ciphertext} from '#/crypto/privacy';
	import {Accounts} from '#/store/accounts';
	import {Agents} from '#/store/agents';
	import {Apps} from '#/store/apps';
	import type {AppProfile} from '#/store/apps';
	import {Chains} from '#/store/chains';
	import {Contracts} from '#/store/contracts';
	
	import {Secrets} from '#/store/secrets';
	import {fold, forever, ode, proper} from '#/util/belt';
	import {buffer_to_text} from '#/util/data';
	import {dd, open_external_link, qsa} from '#/util/dom';
	import {phrase_to_hyphenated} from '#/util/format';
	
	import Copyable from './Copyable.svelte';
	import Field from './Field.svelte';
	import Gap from './Gap.svelte';
	import Load from './Load.svelte';
	import LoadingRows from './LoadingRows.svelte';
	import PasswordField from './PasswordField.svelte';
	import Put from './Put.svelte';
	import Row from './Row.svelte';
	import Address from '../frag/Address.svelte';
	import MemoReview from '../frag/MemoReview.svelte';
	import PfpDisplay from '../frag/PfpDisplay.svelte';
	import QueryPermitRow from '../frag/QueryPermitRow.svelte';
	
	import TransactionHashField from '../frag/TransactionHashField.svelte';
	
	import SX_ICON_COPY from '#/icon/copy.svg?raw';
	import SX_ICON_EXPAND from '#/icon/expand.svg?raw';
	import SX_ICON_EYE from '#/icon/visibility.svg?raw';


	export let configs: FieldConfig[];

	/**
	 * If true, enables flex row display for fields
	 */
	export let flex = false;

	export let noHrs = false;

	export let incident: Incident.Struct | null = null;
	export let chain: ChainStruct | null = null;
	export let network: CosmosNetwork | null = null;
	export let loaded: Promise<any> | null = null;

	const b_password_revealed = false;

	async function decrypt_memo(s_memo: string): Promise<string> {
		const {
			chain: p_chain,
			height: s_height,
			msgs: [
				{
					events: {
						transfer: g_transfer,
					},
				},
			],
			gas_wanted: s_gas_wanted,
			signers: a_signers,
		} = (incident as Incident.Struct<'tx_in' | 'tx_out'>).data as TxSynced;

		const s_sequence = a_signers![0].sequence;

		const {
			recipient: sa_recipient,
			sender: sa_sender,
		} = g_transfer;


		const b_outgoing = 'tx_out' === incident.type;

		const sa_owner = (b_outgoing? sa_sender: sa_recipient) as string;
		const sa_other = (b_outgoing? sa_recipient: sa_sender) as string;

		const [, g_account] = await Accounts.find(sa_owner, $yw_chain);

		// wait for load to complete
		await loaded;

		// locate others's public key
		let atu8_pubkey_65: Uint8Array;
		try {
			({
				pubkey: atu8_pubkey_65,
			} = await network.e2eInfoFor(sa_other));
		}
		catch(e_info) {
			throw syserr({
				title: 'Other Account Unpublished',
				error: e_info,
			});
		}

		const atu8_nonce = await ecdh_nonce([s_sequence]);

		const atu8_ciphertext = extract_memo_ciphertext(s_memo);

		const atu8_plaintext = await network.ecdhDecrypt(atu8_pubkey_65, atu8_ciphertext, atu8_nonce, chain, g_account);

		return buffer_to_text(atu8_plaintext).replace(/\0+$/, '');
	}


	const b_profile_load_attempted = false;
	let g_profile: AppProfile | undefined;


	async function load_resource(gc_field: Awaited<FieldConfig<'resource'>>): Promise<[{
		app: AppStruct;
		chain: ChainStruct;
		account: AccountStruct;
	}[typeof gc_field['resourceType']] | null, string]> {
		// struct given; return as-is
		const g_struct = gc_field['struct'] || await (async() => {
			// ref resource path
			const p_resource = gc_field['path'];

			// depending on resource type
			switch(gc_field.resourceType) {
				case 'app': return await Apps.at(p_resource as AppPath);
				case 'chain': return await Chains.at(p_resource as ChainPath);
				case 'account': return await Accounts.at(p_resource as AccountPath);
				default: return null;
			}
		})();

		// depending on resource type
		return [g_struct, (() => {
			switch(gc_field.resourceType) {
				case 'app': return (g_struct as AppStruct).host;
				case 'chain': return (g_struct as ChainStruct).reference;
				case 'account': return (g_struct as AccountStruct).family;
				default: return '';
			}
		})()];
	}

	async function load_contact(w_contact: Promisable<Bech32>, g_chain: ChainStruct): Promise<[Bech32, ContactStruct | AccountStruct | null]> {
		const sa_contact = await w_contact;

		// create contact path
		const p_contact = Agents.pathForContactFromAddress(sa_contact);

		// attempt to locate agent
		const g_contact = await Agents.getContact(p_contact) || null;

		// contact found
		if(g_contact) return [sa_contact, g_contact];

		// no contact, check accounts
		try {
			const [p_account, g_account] = await Accounts.find(sa_contact, g_chain);

			return [sa_contact, g_account];
		}
		catch(e_find) {
			return [sa_contact, null];
		}
	}

	async function load_account(p_account: AccountPath) {
		return (await Accounts.at(p_account))!;
	}

	async function load_app(p_app: AppPath) {
		return (await Apps.at(p_app))!;
	}
	
	async function load_query_permit(p_secret: SecretPath<'query_permit'>) {
		const g_secret = await Secrets.metadata(p_secret);
		return {
			g_secret,
			g_app: await Apps.at(g_secret.outlets[0]),
		};
	}

	async function render_resource(g_resource: Nameable & Pfpable, si_class: string): Promise<HTMLDivElement> {
		return dd('div', {
			class: `resource ${si_class}`,
		}, [
			await svelte_to_dom(PfpDisplay, {
				resource: g_resource,
				dim: 16,
			}, 'loaded'),

			classify(g_resource.name, `${si_class}-name`),
		]);
	}

	async function load_dynamic_content(dm_dom: HTMLElement) {
		const g_cache_chains: Record<ChainPath, ChainStruct> = {};

		for(const dm_deferred of qsa(dm_dom, 'span.dynamic-deferred-content')) {
			const d_observer = new MutationObserver((a_mutations: MutationRecord[]) => {
				for(const d_mutation of a_mutations) {
					// deferred element was removed
					if([...d_mutation.removedNodes].includes(dm_deferred)) {
						d_observer.disconnect();

						setTimeout(() => {
							[...d_mutation.addedNodes].map(dm_added => void load_dynamic_content(dm_added.parentElement!));
						}, 0);
					}
				}
			});

			// watch parent element
			d_observer.observe(dm_deferred.parentElement!, {
				childList: true,
			});
		}

		for(const dm_bech32 of qsa(dm_dom, 'span.dynamic-inline-bech32')) {
			const {
				bech32: sa_addr,
				chainPath: p_chain,
			} = dm_bech32.dataset as {
				bech32: Bech32;
				chainPath: ChainPath;
			};

			const g_chain = g_cache_chains[p_chain] = g_cache_chains[p_chain] || await Chains.at(p_chain);

			const [si_hrp] = sa_addr.split('1');

			// find appropriate bech32 space
			if(g_chain?.bech32s) {
				const dm_replace = await (async() => {
					for(const [, si_hrp_test] of ode(g_chain.bech32s)) {
						// found matching hrp in current chain
						if(si_hrp === si_hrp_test) {
							// account
							try {
								const [p_account, g_account] = await Accounts.find(sa_addr, g_chain);

								return await render_resource(g_account, 'account');
							}
							catch(e_find) {}

							// contact
							const p_contact = Agents.pathForContactFromAddress(sa_addr);
							const g_contact = await Agents.getContact(p_contact);
							if(g_contact) {
								return await render_resource(g_contact, 'contact');
							}

							// contract
							const p_contract = Contracts.pathFor(p_chain, sa_addr);
							const g_contract = await Contracts.at(p_contract);
							if(g_contract) {
								return await render_resource(g_contract, 'contract');
							}

							// use address
							return await svelte_to_dom(Address, {
								copyable: true,
								address: sa_addr,
							});

							// return null;
						}
					}
				})();

				if(dm_replace) {
					dm_bech32.replaceWith(dm_replace);
					continue;
				}
			}
		}
	}
</script>

<style lang="less">
	hr.minimal {
		margin: calc(var(--ui-padding) / 2);
		visibility: hidden;
	}

	.fields {
		&.flex {
			display: flex;

			>* {
				:global(&) {
					flex: 1;
				}
			}
		}
	}
</style>

<div class="fields" class:flex={flex}>
	{#each configs as z_field, i_field}
		{#if i_field && !flex}
			<hr class:minimal={noHrs}>
		{/if}

		{#await z_field}
			<Load forever />
		{:then gc_field}
			{#if 'key_value' === gc_field.type}
				<Field
					short={!gc_field.long && !gc_field.pfp}
					key={gc_field.key.toLowerCase()}
					name={gc_field.key}
					simple={'mono' === gc_field.render}
				>
					<div style="display:flex;">
						{#if gc_field.pfp}
							<PfpDisplay dim={32} path={gc_field.pfp} />
						{/if}

						<div style="display:flex; flex-flow:column; max-width:100%">
							{#await gc_field.value}
								<Load forever />
							{:then z_value}
								{#if 'string' === typeof z_value}
									{#if 'address' === gc_field.render}
										<Address address={z_value} copyable />
									{:else if 'mono' === gc_field.render}
										<span class="font-variant_mono">
											{z_value}
										</span>
									{:else}
										{z_value}
									{/if}
								{:else}
									<Put element={z_value} />
								{/if}
							{/await}

							{#if gc_field.subvalue}
								<div class="global_subvalue">
									<Load input={gc_field.subvalue} />
								</div>
							{/if}
						</div>

						{#each gc_field.after || [] as dm_after}
							<Put element={dm_after} />
						{/each}
					</div>
				</Field>
			{:else if 'memo' === gc_field.type}
				{#if gc_field.value?.startsWith('🔒1')}
					{#await decrypt_memo(gc_field.value)}
						<MemoReview
							memoPlaintext={forever('')}
							memoCiphertext={forever('')}
						/>
					{:then s_plaintext}
						<MemoReview
							memoPlaintext={s_plaintext}
							memoCiphertext={gc_field.value}
						/>
					{:catch}
						<MemoReview
							memoPlaintext={null}
							memoCiphertext={gc_field.value}
						/>
					{/await}
				{:else}
					<MemoReview
						memoPlaintext={gc_field.value || ''}
					/>
				{/if}
			{:else if 'transaction' === gc_field.type}
				<TransactionHashField hash={gc_field.hash} chainStruct={gc_field.chain} label={gc_field.label} />
			{:else if 'links' === gc_field.type}
				<div class="links">
					{#await gc_field.value}
						<Load forever />
					{:then a_links}
						{#each a_links as g_link}
							<span class="link" on:click={() => open_external_link(g_link.href)}>
								{#if g_link.icon}
									<span class="global_svg-icon icon-diameter_20px">
										{@html g_link.icon}
									</span>
								{/if}
								<span class="text">
									{g_link.text}
								</span>
							</span>
						{/each}
					{/await}
				</div>
			{:else if 'resource' === gc_field.type}
				{@const si_res_type = gc_field.resourceType}
				<Field short={!!gc_field.short}
					key={`resource-${si_res_type}`} name={gc_field.label || proper(si_res_type)}
				>
					{#await load_resource(gc_field)}
						<Load forever />
					{:then [g_resource, s_detail]}
						{#if g_resource}
						<!-- ; padding:calc(0.5 * var(--ui-padding)) 1px; -->
							<Row
								rootStyle='border:none; padding:0;'
								resource={g_resource}
								detail={s_detail}
							/>
						{:else}	
							<Row
								rootStyle='border:none; padding:0;'
								name={`Unknown ${proper(si_res_type)}`}
								detail={gc_field.path || '(null)'}
							/>
						{/if}
					{/await}
				</Field>
			{:else if 'password' === gc_field.type}
				<PasswordField password={gc_field.value} label={gc_field.label} />
			{:else if 'accounts' === gc_field.type}
				<Field short={!!gc_field.short}
					key={phrase_to_hyphenated(gc_field.label || 'accounts')} name={gc_field.label || 'Accounts'}
				>
					{#each gc_field.paths as p_account}
						{#await load_account(p_account)}
							<Load forever />
						{:then g_account} 
							<Row pfpDim={gc_field.short? 22: 0}
								rootStyle='border:none; padding:0;'
								resource={g_account}
							/>
						{/await}
					{/each}
				</Field>
			{:else if 'apps' === gc_field.type}
				<Field short={!!gc_field.short}
					key={phrase_to_hyphenated(gc_field.label || 'apps')} name={gc_field.label || 'Apps'}
				>
					{#each gc_field.paths as p_app}
						{#await load_app(p_app)}
							<Load forever />
						{:then g_app} 
							<Row pfpDim={gc_field.short? 22: 0}
								rootStyle='border:none; padding:0;'
								resource={g_app}
							/>
						{/await}
					{/each}
				</Field>
			{:else if 'contacts' === gc_field.type}
				<Field key={phrase_to_hyphenated(gc_field.label || 'affiliated-addresses')} name={gc_field.label || 'Affiliated address'}>
					{#each gc_field.bech32s as w_agent}
						{#await load_contact(w_agent, gc_field.g_chain)}
							<Load forever />
						{:then [sa_agent, g_contact]} 
							<Copyable confirmation="Address copied!" let:copy>
								{#if g_contact}
									<Row
										rootStyle='border:none; padding:calc(0.5 * var(--ui-padding)) 1px;'
										resource={g_contact}
										address={sa_agent}
										on:click={() => copy(sa_agent)}
									/>
								{:else}	
									<Row
										rootStyle='border:none; padding:calc(0.5 * var(--ui-padding)) 1px;'
										name={`Unknown`}
										address={sa_agent}
										on:click={() => copy(sa_agent)}
									/>
								{/if}
							</Copyable>
						{/await}
					{/each}
				</Field>
			{:else if 'contracts' === gc_field.type}
				<Field key='involved-contracts' name={gc_field.label || 'Contracts'}>
					{@const {g_chain, g_app} = gc_field}
					{@const z_bech32s = gc_field.bech32s}
					{@const h_bech32s = Array.isArray(z_bech32s)? fold(z_bech32s, sa => ({[sa]:''})): z_bech32s}
					{#each ode(h_bech32s) as [sa_contract, w_disabled]}
						{#await produce_contract(sa_contract, g_chain, g_app)}
							<LoadingRows />
						{:then g_contract} 
							<Copyable confirmation="Address copied!" let:copy>
								<Row appRelated cancelled={!!w_disabled}
									rootStyle='border:none; padding:calc(0.5 * var(--ui-padding)) 1px;'
									resource={g_contract}
									pfp={g_contract.pfp || (g_app? `pfp:${g_app.scheme}://${g_app.host}/${g_chain.namespace}:${g_chain.reference}:${g_contract.bech32}`: '')}
									address={g_contract.bech32}
									on:click={() => copy(g_contract.bech32)}
								/>
							</Copyable>
						{/await}
					{/each}
				</Field>
			{:else if 'query_permit' === gc_field.type}
				{@const p_secret = gc_field.secret}
				{#await load_query_permit(p_secret)}
					<LoadingRows />
				{:then {g_secret, g_app}}
					<Field key='query-permit' name='Query Permit'>
						<QueryPermitRow secret={g_secret} app={g_app} />
					</Field>
				{/await}
			{:else if 'dom' === gc_field.type}
				{#if gc_field.title}
					<Field
						key={gc_field.title.toLowerCase()}
						name={gc_field.title}
						unlabeled={!!gc_field.unlabeled}
					>
						<div class="global_dom-field">
							<Put element={gc_field.dom} on:mount={d_event => load_dynamic_content(d_event.detail)} />
						</div>
					</Field>
				{:else}
					<div class="global_dom-field">
						<Put element={gc_field.dom} on:mount={d_event => load_dynamic_content(d_event.detail)} />
					</div>
				{/if}
			{:else if 'slot' === gc_field.type}
				{#if 0 === gc_field.index && $$slots.slot_0}
					<slot name='slot_0' data={gc_field.data}></slot>
				{:else if 1 === gc_field.index && $$slots.slot_1}
					<slot name='slot_1' data={gc_field.data}></slot>
				{:else if 2 === gc_field.index && $$slots.slot_2}
					<slot name='slot_2' data={gc_field.data}></slot>
				{/if}
			{:else if 'gap' === gc_field.type}
				<Gap plain />
			{:else if 'group' === gc_field.type}
				{#await gc_field.fields}
					<LoadingRows />
				{:then a_configs}
					<svelte:self noHrs={!gc_field.expanded} flex={!!gc_field.flex} configs={a_configs} />
				{/await}
			{/if}
		{/await}
	{/each}
</div>
