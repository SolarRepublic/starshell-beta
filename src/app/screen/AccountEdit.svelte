<script lang="ts">
	import {getContext} from 'svelte';

	import type {Completed} from '#/entry/flow';

	import type {Account, AccountStruct, AccountPath} from '#/meta/account';
	import type {Bech32} from '#/meta/chain';
	import {Accounts} from '#/store/accounts';
	import {Chains} from '#/store/chains';
	import {yw_account_editted, yw_account_ref, yw_chain} from '../mem';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Address from '../ui/Address.svelte';
	import Field from '../ui/Field.svelte';
	import Info from '##/ui/Info.svelte';
	import {Screen, type Page} from './_screens';
	import PfpGenerator from '../ui/PfpGenerator.svelte';
	import {Secrets} from '#/store/secrets';
	import {base64_to_buffer, buffer_to_base64, text_to_base64, text_to_buffer} from '#/util/data';

	import SX_ICON_ARROW from '#/icon/expand_more.svg?raw';
	import Tooltip from '../ui/Tooltip.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import { dd, qsa, render_svg_squarely } from '#/util/dom';
	import { Pfps } from '#/store/pfps';
	import { Medias } from '#/store/medias';
	import { N_PX_DIM_ICON } from '#/share/constants';
	import type { Dict, JsonValue } from '#/meta/belt';
	import type { ImageSet, PfpPath, PfpTarget } from '#/meta/pfp';
	import { syserr } from '../common';
	import { load_flow_context } from '../svelte';
    import { Incidents } from '#/store/incidents';
    import Load from '../ui/Load.svelte';

	export let accountPath: AccountPath;
	const p_account = accountPath;

	let g_account: AccountStruct;

	export let oneway = false;

	let s_name = '';
	let sa_account: Bech32 | string;

	$: b_form_valid = !!s_name;

	$: sa_account = g_account && $yw_chain? Chains.addressFor(g_account.pubkey, $yw_chain): '';

	const {
		k_page,
		completed,
	} = load_flow_context();

	let atu8_seed = crypto.getRandomValues(new Uint8Array(32));
	let i_offset = 0;

	let dm_svg_pfpg: SVGSVGElement;

	// off-screen canvas
	let dm_canvas_glob: HTMLCanvasElement;

	async function load_account() {
		const ks_accounts = await Accounts.read();
		g_account = ks_accounts.at(p_account)!;
		if(!g_account) {
			console.error(`Account '${p_account}'' was not found in %o`, ks_accounts.raw);
			debugger;
		}

		const p_secret_art = g_account.utilityKeys.antiPhishingArt;
		if(p_secret_art) {
			await Secrets.borrow(p_secret_art, kn => atu8_seed = kn.clone().data);
		}

		// use existing offset if one is set
		i_offset = g_account.extra?.pfpg?.offset || 0;

		s_name = g_account.name;
	}

	async function save_account() {
		// prep pfp icon
		let p_pfp: PfpTarget = '';

		// prep the square icons
		try {
			const h_renders = await render_svg_squarely(dm_svg_pfpg, [
				32,  // account switcher
				48,  // app banner
				N_PX_DIM_ICON,  // anywhere else
			]);

			// add square pfp
			p_pfp = await Pfps.open(ks => ks.add({
				type: 'plain',
				image: {
					...h_renders,
					default: h_renders[N_PX_DIM_ICON],
				},
			}));
		}
		// don't let runtime error prevent account creation
		catch(e_pfp) {
			syserr({
				title: 'Failed to save account PFP',
				error: e_pfp,
			});
		}

		// // save aura
		// const [p_pfp, g_pfp] = await Pfps.addSvg(dm_svg_pfpg);

		// prep aura media
		let sx_aura = '';

		// produce and save aura
		try {
			// remove all drawn elements except for the background
			qsa(dm_svg_pfpg, ':scope>:not(style,defs,.background)').map(dm => dm.remove());

			// remove other unnecessary svg elements
			qsa(dm_svg_pfpg, ':scope>defs>:not(#pfpg-background)').map(dm => dm.remove());

			// remove unneeded rules
			qsa(dm_svg_pfpg, 'style').forEach((dm_style) => {
				const d_sheet = dm_style.sheet;
				if(!d_sheet) return;

				// each rule in reverse order
				const a_rules = [...d_sheet.cssRules];
				for(let i_rule=a_rules.length-1; i_rule>=0; i_rule--) {
					const d_rule = a_rules[i_rule];

					// style rule
					if(d_rule instanceof CSSStyleRule) {
						// not interested; delete it
						if(!/^\*|(rect)?(\.background)?$/.test(d_rule.selectorText)) {
							d_sheet.deleteRule(i_rule);
						}
					}
				}
			});

			// remove svelte classes
			qsa(dm_svg_pfpg, '*').forEach((dm_node: SVGElement) => {
				const s_class = dm_node.getAttribute('class')?.split(/\s+/g)
					?.filter(s => !/^s-[a-zA-Z0-9]{12}$/.test(s))?.join(' ') || '';

				if(s_class) dm_node.setAttribute('class', s_class);
				else dm_node.removeAttribute('class');
			});

			// remove all classes from svg root element
			dm_svg_pfpg.removeAttribute('class');

			// save as string
			sx_aura = dm_svg_pfpg.outerHTML.replace(/(>)\s+(<)|([;:,])\s+|\s*([{}])\s*/g, '$1$2$3$4');
		}
		// don't let runtime error prevent account creation
		catch(e_remove) {
			syserr({
				title: 'Failed to render Aura',
				error: e_remove,
			});
		}

		// compute deltas
		const a_deltas: [string, string, string][] = [];
		const deltavize = (si_key: string, z_before: any, z_after: any) => {
			if(z_before !== z_after) a_deltas.push([si_key, z_before? z_before+'': '', z_after+'']);
		};

		deltavize('name', g_account.name, s_name);
		deltavize('extra.pfpg.offset', (g_account.extra?.pfpg?.offset || 0) + 1, i_offset + 1);

		// update account data
		Object.assign(g_account, {
			name: s_name,
			pfp: p_pfp,
			extra: {
				...g_account.extra,
				aura: sx_aura,
				pfpg: {
					offset: i_offset,
				},
			},
		});

		// save to account
		await Accounts.open(ks => ks.put(g_account));

		// save to incidents
		await Incidents.record({
			type: 'account_edited',
			data: {
				account: p_account,
				deltas: a_deltas,
			},
		});

		// editted active account; reload
		if(p_account === $yw_account_ref) {
			$yw_account_ref = p_account;
		}

		// trigger account edit
		$yw_account_editted++;

		if(completed) {
			completed(true);
		}
		else {
			k_page.reset();
		}
	}

	// function save() {
	// 	if(!b_form_valid) return;

	// 	const g_save = {
	// 		label: accountName,
	// 		tagRefs: a_tags.map(k => k.def.iri),
	// 	};

	// 	if(account) {
	// 		Object.assign(account.def, g_save);

	// 		restart();

	// 		if(Tasks.ADD_TAG === $yw_task) {
	// 			setTimeout(() => {
	// 				$yw_task = -$yw_task;
	// 			}, 1200);
	// 		}
	// 	}
	// 	else {
	// 		const gd_account = Account.Def.fromConfig({
	// 			...g_save,
	// 			pubkey: sa_account.replace(/^\w+1/g, ''),
	// 			iconRef: p_icon,
	// 		});

	// 		const k_account = H_ACCOUNTS[gd_account.iri] = new Account(gd_account);

	// 		restart();

	// 		push_screen(AccountView, {
	// 			account: k_account,
	// 		});
	// 	}
	// }


	let b_tooltip_showing = false;

</script>

<style lang="less">
	@import './_base.less';

	.tooltip {
		position: absolute;
		right: var(--ui-padding);
		margin: 1px;
		padding: 0.5em 0.75em;
		border-radius: 0 0 0 10px;
		background-color: transparent;
	}

	.pfpg-preview {
		margin-bottom: -24px;
		display: flex;

		position: relative;
		.offset {
			position: absolute;
			top: 1px;
			left: 1px;
			background-color: rgba(0,0,0,0.6);
			padding: 6px 8px;
			width: 2.5em;
			border-radius: 10px 0 8px 0px;
			color: var(--theme-color-text-med);
			.font(mono);
			border: 1px solid var(--theme-color-border);
			border-top-color: transparent;
			border-left-color: transparent;
		}
	}

	.generator {
		position: relative;
		top: -10px;
		margin: 0 8px;

		display: flex;
		// gap: 0.75em;
		justify-content: space-between;

		>* {
			flex: 1;
			max-width: 4.25em;

			.prev {
				transform: rotate(90deg) scale(1.5);
			}

			.next {
				transform: rotate(-90deg) scale(1.5);
			}
		}
	}
</style>

<Screen>
	<h3>
		{accountPath? 'Edit': 'New'} account
	</h3>

	<span style="display:none" class:pfpg-preview={false} class:generator={false}></span>

	{#await load_account()}
		<Load forever />
	{:then}
		<Field key="profile-icon" name="Profile image">
			<span class="tooltip">
				<Tooltip overlayStyle='right:0;' bind:showing={b_tooltip_showing}>
					These images are procedurally generated by your account.
					They are universally unique to your private key. <br><br>
					Using one as your profile image helps protect against phishing attacks,
					since fake sites won't be able to fake your profile image.
				</Tooltip>
			</span>

			<div class="pfpg-preview">
				<PfpGenerator offset={i_offset} seed={atu8_seed} bind:svgElement={dm_svg_pfpg} />

				<span class="offset">
					#{i_offset+1}
				</span>
			</div>

			<div class="generator">
				<button class="pill" on:click={() => i_offset--} disabled={0 === i_offset}>
					<span class="global_svg-icon icon-diameter_14px prev">
						{@html SX_ICON_ARROW}
					</span>
				</button>
				<button class="pill" on:click={() => i_offset++}>
					<span class="global_svg-icon icon-diameter_14px next">
						{@html SX_ICON_ARROW}
					</span>
				</button>
			</div>
			<!-- <IconEditor intent='person' iconRef={p_icon} /> -->
		</Field>

		<Field key="account-name" name="Name">
			<input id="account-name" type="text" bind:value={s_name} placeholder="Satoshi">
		</Field>

		<!-- <Field key="account-path" name="Derivation path">
			<Info key="account-path">
				m/44'/118'/0'/0/{Object.values(H_ACCOUNTS).length}
			</Info>
		</Field> -->

		<Field key="account-address" name="Public address">
			<Info address key="account-address">
				<Address copyable address={sa_account} />
			</Info>
		</Field>
<!-- 
		<Field key="account-tags" name="Add tags">
			<InlineTags editable resourcePath={p_account} />
		</Field> -->

		{#if oneway}
			<ActionsLine confirm={['Finish', save_account, !b_form_valid]} />
		{:else}
			<ActionsLine cancel={!completed} back confirm={['Finish', save_account, !b_form_valid]} />
		{/if}

		<!-- <div class="action-line clickable">
			<button on:click={() => pop()}>
				Cancel
			</button>

			<button class="primary" readonly={!b_form_valid} on:click={() => save()}>
				Finish
			</button>
		</div> -->
	{/await}

	<Curtain on:click={() => b_tooltip_showing = false} />
</Screen>