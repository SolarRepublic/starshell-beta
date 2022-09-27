<script lang="ts">
	import {getContext, SvelteComponent} from 'svelte';
	import {microtask, ode, ofe, proper} from '#/util/belt';

	import type {Contact, ContactPath} from '#/meta/contact';
	import {ContactAgentType} from '#/meta/contact';
	import {Agents} from '#/store/agents';
	import type {Page} from '../nav/page';
	import {yw_chain, yw_chain_namespace} from '../mem';
	import {Chains} from '#/store/chains';
	import {R_BECH32} from '#/share/constants';
	import {Tags} from '#/store/tags';
	import {Header, Screen} from './_screens';
	import ContactView from './ContactView.svelte';
	import Field from '../ui/Field.svelte';
	import Info from '../ui/Info.svelte';
	import type {Chain, ChainInterface, ChainPath} from '#/meta/chain';
	import InlineTags from '../ui/InlineTags.svelte';
	import IconEditor from '../ui/IconEditor.svelte';

	const k_page = getContext<Page>('page');

	/**
	 * Contact resource path
	 */
	export let contactRef: ContactPath | '' = '';
	const p_contact = contactRef || '';

	// prep object placeholder
	let g_contact: Contact['interface'];

	// path was given; load contact
	if(p_contact) void Agents.getContact(p_contact).then(g => g_contact = g!);

	// load all chains
	let h_chains: Record<ChainPath, ChainInterface> = {};
	(async function load_chains() {
		h_chains = ofe((await Chains.read()).entries());
	})();

	// TODO: fix all bech32 address stuff here

	// reactively destructure contact's properties
	$: s_name = g_contact?.name || '';
	$: sa_bech32 = g_contact? Agents.addressFor(g_contact, $yw_chain): '';
	$: s_notes = g_contact?.notes || '';
	$: si_agent_type = g_contact?.agentType || ContactAgentType.PERSON;

	let s_err_name = '';
	let s_err_address = '';

	// TODO: handle matching multiple chains from single address
	async function infer_address(sa_address: string, b_show_err=false): string {
		const m_bech = R_BECH32.exec(sa_address);
		if(!m_bech) {
			if(b_show_err) {
				s_err_address = 'Invalid Bech32 address';
			}
	
			return '';
		}

		const [, si_hrp, , s_data] = m_bech;

		// read all chains
		const ks_chains = await Chains.read();

		// attempt to locate compatible chains using bech32 hrp
		let a_chains_match: ChainInterface[] = [];
		for(const [, g_chain] of ks_chains.entries()) {
			if(g_chain.bech32s.acc === si_hrp) {
				a_chains_match.push(g_chain);
			}
		}

		if(b_show_err) {
			if(!a_chains_match) {
				s_err_address = `No locally known chains matched the address prefix "${si_hrp}"`;
			}
			else {
				s_err_address = '';
			}
		}

		return sa_bech32 = sa_address;
	}

	$: b_form_valid = !!(s_name && infer_address(sa_bech32));
	let c_show_validations = 0;

	$: {
		if(c_show_validations) {
			s_err_name = s_name? '': 'Name must not be empty';
			infer_address(sa_bech32, true);
		}
	}

	let b_busy = false;

	let y_screen: SvelteComponent;
	async function save() {
		if(!b_form_valid) {
			c_show_validations++;

			return;
		}
		else if(p_contact) {
			Object.assign(g_contact, {
				name: s_name,
				addressSpace: 'acc',
				addressData: R_BECH32.exec(sa_bech32 as string)![3],
				chains: a_chains_,
				pfp: g_contact.pfp,
				agentType: si_agent_type,
				notes: s_notes,
			});

			k_page.reset();
			// setTimeout(() => {
			// 	try {
			// 		y_screen.$destroy();
			// 	}
			// 	catch(e) {}
	
			// 	contact = H_CONTACTS[contact.def.iri];
			// 	push_screen(ContactView, {
			// 		contact,
			// 	});
			// }, 5);
		}
		else {
			g_contact = {
				name: s_name,
				namespace: $yw_chain_namespace,
				address: s_addr,
				pfp: g_contact.pfp,
				agentType: si_agent_type,
				notes: s_notes,
				space: 'acc',
				origin: 'user',
				chains: {},
			};
		}


		b_busy = true;
		try {
			await Agents.open(async(ks_agents) => {
				await ks_agents.putContact(g_contact);
			});

			k_page.reset();

			// immediately open new contact
			k_page.push({
				creator: ContactView,
				props: {
					contactRef: p_contact,
				},
			});
		}
		catch(e_write) {
			b_busy = false;
		}
	}

	// let p_icon: Icon.Ref = contact?.def.iconRef || '' as Icon.Ref;
</script>

<style lang="less">
	@import './_base.less';

	#chain-namespace {
		:global(&) {
			flex: 1;
			align-items: baseline;
			.font(tiny);
			color: var(--theme-color-text-med);

			overflow: hidden;
			text-overflow: ellipsis;
		}
	}
</style>

<Screen bind:this={y_screen} leaves>
	<Header
		plain pops
		title="{p_contact? 'Edit': 'Add New'} Contact"
	/>

	<Field
		key="contact-pfp"
		name="Profile Icon"
	>
		<IconEditor intent='person' pfpRef={g_contact?.pfp} bind:name={s_name} />
	</Field>

	<Field
		key="chain-namespace"
		name="Chain Namespace"
	>
		<Info key="chain-namespace">
			<style lang="less">
				@import './_base.less';

				.title {
					.font(regular);
					color: var(--theme-color-text-light);
				}

				.examples {
					margin-left: 0.5em;
				}
			</style>

			<span class="title">
				{proper($yw_chain_namespace)}
			</span>

			<span class="examples">
				({ode(h_chains).filter(([, g]) => $yw_chain_namespace === g.namespace).map(([, g]) => g.bech32s.acc).join(', ')})
			</span>
		</Info>
	</Field>


	<Field
		key="contact-name"
		name="Name"
	>
		<input class:invalid={s_err_name} type="text" spellcheck="false" bind:value={s_name} placeholder="Enter a name">

		{#if s_err_name}
			<span class="validation-message">
				{s_err_name}
			</span>
		{/if}
	</Field>

	<Field
		key="contact-address"
		name="Address"
	>
		<input
			type="text"
			class="address"
			class:invalid={s_err_address}
			spellcheck="false"
			placeholder="{$yw_chain.bech32s.acc}1..."
			bind:value={sa_bech32}
		>

		{#if s_err_address}
			<span class="validation-message">
				{s_err_address}
			</span>
		{/if}
	</Field>

	<Field
		key="contact-notes"
		name="Secure Notes"
	>
		<textarea bind:value={s_notes} placeholder=""></textarea>
	</Field>

	<hr>

	<h3>
		{p_contact? 'Edit': 'Add'} Tags
	</h3>

	<InlineTags editable resourcePath={p_contact} />

	<div class="action-line">
		<button on:click={() => k_page.pop()}>
			Back
		</button>

		<button class="primary" on:click={() => save()} readonly={!b_form_valid}>
			{p_contact? 'Save': 'Add'}
		</button>
	</div>
</Screen>