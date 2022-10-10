<script lang="ts">
	import {getContext, onDestroy} from 'svelte';
	import {slide} from 'svelte/transition';
	import BigNumber from 'bignumber.js';

	import {
		yw_account,
		yw_account_ref,
		yw_chain,
		yw_chain_ref,
		yw_network,
		yw_owner,
		yw_page,
		yw_send_asset,
		yw_task,
		// yw_asset_send,
		// yw_holding_send,
	} from '##/mem';

	import SX_ICON_PERSONAL from '#/icon/account_box.svg?raw';
	import SX_ICON_CONTRACT from '#/icon/analytics.svg?raw';
	import SX_ICON_LOADING from '#/icon/donut_large.svg?raw';
	import SX_ICON_INFO from '#/icon/info.svg?raw';
	import SX_ICON_DROPDOWN from '#/icon/drop-down.svg?raw';
	import SX_ICON_VISIBILITY from '#/icon/visibility.svg?raw';
	import SX_ICON_SHIELD from '#/icon/shield.svg?raw';

	import AssetSelect from '##/ui/AssetSelect.svelte';
	import AmountInput from '##/ui/AmountInput.svelte';
	import CheckboxField from '##/ui/CheckboxField.svelte';
	import Header from '##/ui/Header.svelte';
	import Field from '##/ui/Field.svelte';

	// import Execute from './Execute.svelte';
	import type {Account, AccountInterface, AccountPath} from '#/meta/account';

	import {Screen, type Page} from './_screens';
	import type {Token, TokenInterfaceDescriptor} from '#/meta/token';
	import {Entities} from '#/store/entities';
	import SenderSelect from '../ui/SenderSelect.svelte';
	import RecipientSelect from '../ui/RecipientSelect.svelte';
	import type {Bech32, Chain, EntityPath, CoinInfo} from '#/meta/chain';
	import type {Contact, ContactInterface, ContactPath} from '#/meta/contact';
	import {subscribe_store} from '#/store/_base';
	import {Agents} from '#/store/agents';
	import {fold, F_NOOP, ofe} from '#/util/belt';
	import {Chains} from '#/store/chains';
	import {CoinGecko} from '#/store/web-apis';
	import {format_amount, format_fiat} from '#/util/format';
	import {NB_MAX_MEMO, XT_MINUTES} from '#/share/constants';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import SendNative from './SendNative.svelte';
	import {Settings} from '#/store/settings';
	import Notice from '../ui/Notice.svelte';
	import SettingsMemos from './SettingsMemos.svelte';
	import { global_receive } from '#/script/msg-global';
	import { buffer_to_base93, text_to_buffer } from '#/util/data';

	const G_SLIDE_IN = {
		duration: 350,
		delay: 110,
	};

	const G_SLIDE_OUT = {
		duration: 150,
	};


	const k_page = getContext<Page>('page');

	/**
	 * Which account to initiate send from
	 */
	export let sender: AccountInterface = $yw_account;
	let p_account: AccountPath = $yw_account_ref;

	/**
	 * Native coin symbol to use for the transfer
	 */
	export let native: keyof typeof $yw_chain.coins = Object.keys($yw_chain.coins)[0];
	const si_native = native;

	/**
	 * Token to use for transfer (instead of native coin)
	 */
	export let token: TokenInterfaceDescriptor | null = null;
	const g_token = token;


	/**
	 * Address of initial receiver
	 */
	export let recipient = '';
	let sa_recipient = recipient;


	let p_asset: EntityPath | '' = si_native
		? Entities.holdingPathFor($yw_owner, si_native)
		: '';
		// : Entities.pathFrom(g_token);


	// reactively assign the coin struct for the native asset
	$: g_coin = p_asset && 'holding' === Entities.parseEntityPath(p_asset)?.type && si_native? $yw_chain.coins?.[si_native]: null;
	
	// reactively assign the token's path
	$: p_token = p_asset && 'token' === Entities.parseEntityPath(p_asset)?.type && g_token? Entities.pathFrom(g_token): '';


	// cache of contacts
	let h_contacts: Record<ContactPath, ContactInterface>;

	// address to contact lookup cache
	let h_addr_to_contact: Record<Chain.Bech32String, ContactPath>;

	// asset symbol
	$: s_symbol = si_native || g_token?.symbol || '';


	// whether the user has enabled encryption
	let b_private_memo_enabled = false;
	let b_private_memo_published = false;
	let b_private_memo_recipient_published = false;

	// 
	async function reload_settings() {
		const h_e2es = await Settings.get('e2e_encrypted_memos') || null;
		if(h_e2es?.[$yw_chain_ref]) {
			const g_config = h_e2es[$yw_chain_ref];
			({
				enabled: b_private_memo_enabled,
				published: b_private_memo_published,
			} = g_config);

			check_recipient_publicity();
		}
	}

	void reload_settings();

	global_receive({
		updateStore({key:si_store}) {
			if('settings' === si_store) {
				void reload_settings();
			}
		},
	});


	function check_recipient_publicity() {
		b_private_memo_recipient_published = false;
		$yw_network.e2eInfoFor(sa_recipient as Bech32).then((g_info) => {
			b_private_memo_recipient_published = !!g_info.sequence;
		}).catch(() => {
			b_memo_private = false;
		});
	}


	let b_busy_agents = false;
	async function reload_agents(b_init=false) {
		// already busy reloading
		if(b_busy_agents) return;

		// now it's busy
		b_busy_agents = true;

		// load agents store
		const ks_agents = await Agents.read();

		// read contact entries
		const a_contacts = [...ks_agents.contacts()];

		// replace cache
		h_contacts = ofe(a_contacts);

		// replace address lookup cache
		h_addr_to_contact = fold(a_contacts, ([p_contact, g_contact]) => ({
			[Agents.addressFor(g_contact, $yw_chain)]: p_contact,
		}));

		// no longer busy
		b_busy_agents = false;
	}

	// subscriptions
	{
		// reload agents when agents store updates
		const f_unsub_agents = subscribe_store('agents', reload_agents);

		// reload agents when chain changes
		const f_unsub_chain = yw_chain.subscribe(reload_agents as VoidFunction);

		// unsubscribe when screen is destroyed
		onDestroy(() => {
			f_unsub_agents();
			f_unsub_chain();
		});
	}

	$: {
		console.log({
			si_native,
			g_coin,
			p_asset,
			p_token,
			g_token,
		});
	}

	// reactively compute the balance of the selected asset
	let yg_balance: BigNumber | null = null;
	$: s_balance = yg_balance? format_amount(yg_balance.shiftedBy(-(g_coin || g_token)!.decimals).toNumber()): '';
	$: {
		// react to account and asset changes
		if($yw_account && p_asset) {
			yg_balance = null;

			// go async
			queueMicrotask(async() => {
				// indicate loading state
				s_balance = '[...]';

				// start with the cached balance if it exists
				const g_cached = $yw_network.cachedBalance($yw_owner, si_native);
				if(g_cached && g_cached.timestamp > Date.now() - (5 * XT_MINUTES)) {
					yg_balance = new BigNumber(g_cached.data.amount);
				}

				// get the latest balance
				const g_bundle = await $yw_network.bankBalance($yw_owner, si_native);
				if(g_bundle) {
					yg_balance = new BigNumber(g_bundle.balance.amount);
				}
			});
		}
	}


	// input amount user intends to send
	let s_amount = '';

	// apply the maximum amount the user can possibly send
	function use_max() {
		s_amount = s_balance;

		// take away from gas fee
		if(g_coin) {
			s_amount = new BigNumber(s_amount).minus(x_fee).toString();
		}

		c_show_validations++;
	}

	// reactively indicate whether the max is currently being used
	$: b_using_max = s_amount === s_balance;

	// $: {
	// 	if(g_token && Entities.pathFrom(g_to) !== p_entity) {
	// 		s_amount = '';
	// 		c_show_validations = 0;
	// 		p_entity = g_token.iri;
	// 	}
	// }



	// reactively assign the coingecko id from the asset struct
	$: si_coingecko = (g_token || g_coin)?.extra?.coingecko_id || '';

	// reactively fetch the worth of the asset
	let x_worth: number | null = null;
	let s_worth = '';
	const si_versus = 'usd';
	$: {
		// coingecko id is set
		if(si_coingecko) {
			// indicate loading state
			s_worth = '[...]';

			// go async
			(async() => {
				// load the asset's worth from coingecko
				const h_versus = await CoinGecko.coinsVersus([si_coingecko] as string[], si_versus);

				// update the fiat display
				x_worth = h_versus[si_coingecko];
				if('number' === typeof x_worth) {
					s_worth = format_fiat(x_worth, si_versus);
				}
				// set error indication
				else {
					s_worth = '(?)';
				}
			})();
		}
		// don't display anything
		else {
			s_worth = '';
		}
	}


	const x_fee = 0.01;
	
	$: s_fee_fiat = 'number' === typeof x_worth? format_fiat(x_fee * x_worth, 'usd'): '';

	
	
	// // 
	// if($yw_asset_send) {
	// 	$yw_chain_ref = $yw_asset_send.chainRef;
	// }

	const H_ADDRESS_TYPES = {
		none: {
			icon: '<svg></svg>',
			text: '',
		},

		unknown: {
			icon: SX_ICON_LOADING,
			text: 'Determining address type...',
		},

		personal: {
			icon: SX_ICON_PERSONAL,
			text: 'Personal address',
		},

		contract: {
			icon: SX_ICON_CONTRACT,
			text: 'Contract address',
		},
	} as const;

	let si_address_type: keyof typeof H_ADDRESS_TYPES = 'none';
	$: g_address_type = H_ADDRESS_TYPES[si_address_type];


	$: {
		if(!sa_recipient) {
			si_address_type = 'none';
		}
		else {
			si_address_type = 'unknown';

			void $yw_network.isContract(sa_recipient as Bech32).then((b_contract) => {
				if(b_contract) {
					si_address_type = 'contract';
				}
				else {
					si_address_type = 'personal';
				}
			});

			check_recipient_publicity();
		}
	}



	let b_memo_expanded = false;
	let b_memo_private = false;
	let s_memo = '';

	function submit() {
		if(!b_form_valid) {
			c_show_validations++;
			return;
		}
		else {
			if(si_native) {
				k_page.push({
					creator: SendNative,
					props: {
						accountRef: p_account,
						coin: si_native,
						recipient: sa_recipient,
						amount: s_amount,
						memoPlaintext: s_memo,
						encryptMemo: (b_memo_private || (!s_memo.length && b_private_memo_enabled && b_private_memo_published)) && b_private_memo_recipient_published,
						fee: x_fee+'',
					},
				});
			}
			else {
				// k_page.pusyw_send_asset
				// 	creator: Execute,
				// 	props: {
				// 		contract: $yw_asset_send?.address,
				// 		snip20: yw_send_asset
				// 			transfer: {
				// 				recipient: sa_receiver,
				// 				amount: $yw_asset_send?.denomFromString(s_amount) || '0',
				// 			},
				// 		},
				// 	},
				// });
			}
		}
	}

	let c_show_validations = 0;

	let b_checked_save_contact = false;
	const b_dead = false;


	let s_err_recipient = '';
	let s_err_amount = '';

	$: b_new_address = sa_recipient && h_addr_to_contact && !(sa_recipient in h_addr_to_contact);


	const R_CONTACT_NAME = /^\S.{0,1023}$/;
	
	let s_new_contact = '';
	$: s_err_new_contact = b_checked_save_contact && (c_show_validations || true)
		? s_new_contact
			? R_CONTACT_NAME.test(s_new_contact)
				? ''
				: s_new_contact.length > 1024
					? 'That name is way too long'
					: 'Cannot begin with space'
			: 'Enter a contact name to save new address'
		: '';

	$: {
		if(b_checked_save_contact && !c_show_validations) {
			s_err_new_contact = '';
		}
	}

	$: b_form_valid = (sa_recipient
		&& s_amount
		&& !s_err_recipient
		&& !s_err_amount
		&& (!b_new_address || !b_checked_save_contact || (s_new_contact && !s_err_new_contact))
	) || false;

	$: {
		console.log({
			to: sa_recipient,
			s_amount,
			s_err_recipient,
			s_err_amount,
		});
	}


	function input_new_contact(d_event: Event) {
		s_new_contact = (d_event.target as HTMLInputElement).value;
	}

	function adjust_memo_settings() {
		k_page.push({
			creator: SettingsMemos,
			context: {
				intent: {
					id: 'send_adjust_memo_settings',
				},
			},
		});
	}
</script>


<style lang="less">
	@import '_base.less';

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	#field-recipient-status {
		:global(&) {
			margin-top: -12px;
		}

		.field-value {
			margin-left: -2px;
		}

		.status {
			:global(&.unknown>.icon) {
				animation: spin 1s linear infinite;
			}
			:global(&.contract>.icon) {
				transform: rotate(90deg);
			}
			:global(&.contract>.icon) {
				transform: rotate(90deg);
			}
		}
	}

	.status {
		color: var(--theme-color-graymed);
		display: flex;
		align-items: center;
		gap: 3px;
		margin-left: -1px;

		>.icon {
			--proxy-icon-diameter: 20px;
			--icon-color: var(--theme-color-graymed);

			:global(svg) {
				width: var(--icon-diameter);
				height: var(--icon-diameter);
			}
		}

		>.text {
			.font(tiny);
		}
	}


	#field-balance {
		:global(&) {
			margin-top: -12px;
		}
	}

	.balance-line {
		.font(tiny, @size: 12px, @weight: 300);
		display: flex;
		justify-content: space-between;

		>.balance {
			>.label {
				color: var(--theme-color-text-med);
			}

			>.amount {
				color: var(--theme-color-text-light);
			}
		}
	}

	.fee-fiat {
		.font(tiny);
		color: var(--theme-color-text-med);
	}

	#field-fee-manual {
		.field-value {
			:global(&) {
				flex: 1;
			}
		}

		.manual-fee {
			:global(&) {
				flex: 2;
			}
		}
	}

	#field-manual-fee {
		:global(&) {
			margin-top: -12px;
		}
	}

	.manual-fee {
		display: flex;
		align-items: center;
		gap: 0.5em;

		>.icon.info {
			--icon-diameter: 18px;
			padding: 2px;
		}
	}

	.memo {
		display: flex;
		flex-direction: column;
		@memo-gap: 0.75em;
		gap: @memo-gap;

		.title {
			display: flex;
			gap: 4px;
			position: relative;

			.icon {
				--icon-diameter: 24px;
				--icon-color: var(--theme-color-primary);
			}

			.text {
				align-self: center;
			}
		}

		:global(fieldset.encrypt) {
			margin-left: auto;
			margin-right: 0.5em;
		}

		.submemo {
			position: relative;

			.disclaimer {
				.font(tiny);
				color: var(--theme-color-text-med);
				text-align: left;
				position: absolute;
				bottom: 1.25em;
			}

			.memo-length-indicator {
				position: absolute;
				right: 0.5em;
				bottom: 3em;
			}
		}

		.dropdown.icon {
			transform: rotate(0deg);
			transition: transform 300ms var(--ease-out-quad);
		}

		&.expanded {
			.dropdown.icon {
				transform: rotate(-180deg);
			}
		}

		.input {
			margin-bottom: 1.5em;
		}
	}

	.new-address {
		margin-top: 12px;
	}

	.disabled.link {
		color: var(--theme-color-text-med);
		font-style: italic;
		text-decoration: line-through;
	}
</style>


<Screen form slides on:submit={(d_submit) => {
	d_submit.preventDefault();
	submit();
}}>
	<Header pops
		title={g_token? 'Transferring': 'Sending'}
		symbol={g_token? g_token.symbol: ''}
		subtitle={$yw_chain?.name || '?'}
	/>

	<Field short
		key='sender-select'
		name='From'
	>
		<SenderSelect
			bind:accountRef={p_account}
			/>
	</Field>

	<Field short
		key='recipient-select'
		name='To'
	>
		<RecipientSelect
			bind:error={s_err_recipient}
			bind:address={sa_recipient}
			showValidation={c_show_validations}
		/>
	</Field>

	<Field short
		key='recipient-status'
		name=''
	>
		<span class="status {si_address_type}">
			<span class="icon">
				{@html g_address_type.icon}
			</span>
			<span class="text">
				{g_address_type.text}
			</span>
		</span>

		{#if b_new_address}
			<div class="new-address">
				<CheckboxField id="save-contact" bind:checked={b_checked_save_contact} >
					Save to contacts
				</CheckboxField>
			</div>
		{/if}
	</Field>

	{#if b_new_address && b_checked_save_contact}
		<Field short slides
			key='new-contact-name'
			name='Contact Name'
		>
			<input id="new-contact-name-value" type="text" on:input={input_new_contact} class:invalid={s_err_new_contact}>

			{#if s_err_new_contact}
				<span class="validation-message">
					{s_err_new_contact}
				</span>
			{/if}
		</Field>
	{/if}

	<hr>

	<Field short
		key='asset-select'
		name='Asset'
	>
		<AssetSelect bind:assetRef={p_asset} />
	</Field>

	<Field short
		key='amount'
		name='Amount'
	>
		<AmountInput
			bufferMax={g_coin? x_fee: 0}
			assetRef={p_asset}
			bind:error={s_err_amount}
			bind:value={s_amount}
			showValidation={c_show_validations}
		/>
	</Field>

	<Field short
		key='balance'
		name=''
	>
		<span class="balance-line">
			{#if p_asset}
				<span class="balance">
					<span class="label">
						Balance
					</span>
					<span class="amount">
						{s_balance} {s_symbol}
					</span>
				</span>

				<span class="use-max">
					<span class="link" class:disabled={b_using_max} on:click={() => use_max()}>USE MAX</span>
				</span>
			{/if}
		</span>
	</Field>

	<hr>

	<Field short
		key='fee-manual'
		name='Fee'
	>
		<div class="fee-amount">
			{x_fee} SCRT
		</div>

		<div class="fee-fiat">
			{s_fee_fiat}
		</div>

		<svelte:fragment slot="post">
			<div class="manual-fee">
<!-- 
				<span class="link disabled">Set fee manually</span>
				<span class="icon info">
					{@html SX_ICON_INFO}
				</span>
				 -->
			</div>
		</svelte:fragment>
	</Field>

	<hr>

	<div class="memo" class:expanded={b_memo_expanded}>
		<div class="title clickable" on:click={() => b_memo_expanded = !b_memo_expanded}>
			<span class="icon dropdown">
				{@html SX_ICON_DROPDOWN}
			</span>
			<span class="text">
				Add memo
			</span>

			{#if b_memo_expanded}
				{#if b_private_memo_enabled && b_private_memo_recipient_published}
					<CheckboxField containerClass='encrypt' id='encrypted' bind:checked={b_memo_private}>
						Private
					</CheckboxField>
				{/if}
			{/if}
		</div>

		{#if b_memo_expanded}
			{#if !b_private_memo_enabled}
				<Notice
					dismissable='send_encrypted_memo'
					title='Make Your Memos Private'
					action={['Enable Private Memos', adjust_memo_settings]}
				>
					StarShell allows you to send end-to-end encrypted memos that can only be seen by you and the recipient.
					<br style="display:block; content:''; margin:0.75em;" />
					Enable this feature to send and receive encrypted memos. You can always change this later in settings.
				</Notice>
			{/if}

			<div class="input" transition:slide={{duration:350}}>
				<textarea bind:value={s_memo}></textarea>
			</div>

			<div class="submemo">
				{#if !b_private_memo_recipient_published}
					<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
						<span class="global_svg-icon display_inline icon-diameter_18px">
							{@html SX_ICON_VISIBILITY}
						</span>
						<span class="text vertical-align_middle">
							Recipient isn't published, memo will be public. <span class="link" on:click={() => adjust_memo_settings()}>Settings</span>
						</span>
					</span>
				{:else if !b_memo_private}
					{#if !s_memo.length && b_private_memo_enabled && b_private_memo_published}
						<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
							<span class="global_svg-icon display_inline icon-diameter_18px">
								{@html SX_ICON_SHIELD}
							</span>
							<span class="text vertical-align_middle">
								Empty memos will still appear encrypted. <span class="link" on:click={() => adjust_memo_settings()}>Memo Settings</span>
							</span>
						</span>
					{:else}
						<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
							<span class="global_svg-icon display_inline icon-diameter_18px">
								{@html SX_ICON_VISIBILITY}
							</span>
							<span class="text vertical-align_middle">
								This memo will be public. <span class="link" on:click={() => adjust_memo_settings()}>Memo Settings</span>
							</span>
						</span>
					{/if}
				{:else}
					<span class="memo-length-indicator" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
						{buffer_to_base93(text_to_buffer(s_memo || '')).length} / {NB_MAX_MEMO}
					</span>

					<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
						<span class="global_svg-icon display_inline icon-diameter_18px" style="color:var(--theme-color-sky);">
							{@html SX_ICON_SHIELD}
						</span>
						<span class="text vertical-align_middle">
							This memo will be private, using encryption. <span class="link" on:click={() => adjust_memo_settings()}>Memo Settings</span>
						</span>
					</span>
				{/if}
			</div>
		{/if}
	</div>

	<ActionsLine cancel='pop' confirm={['Next', () => submit(), !b_form_valid]} />

<!-- 
	<div class="action-line" class:pointer-events_none={b_dead}>
		<button type="button" on:click={() => ((b_dead = true) && k_page.pop())}>
			Cancel
		</button> -->
<!-- 
		<button class="primary" on:click={() => submit()} readonly={!b_form_valid}>
			Next
		</button> -->
	<!-- </div> -->
</Screen>