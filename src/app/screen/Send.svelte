<script lang="ts">
	import type {Any} from '@solar-republic/cosmos-grpc/dist/google/protobuf/any';
	
	import type {AccountPath} from '#/meta/account';
	import type {Bech32, Chain, CoinInfo, ContractPath, ContractStruct, FeeConfig, HoldingPath} from '#/meta/chain';
	import type {ContactPath} from '#/meta/contact';
	import type {TokenStructDescriptor} from '#/meta/token';
	
	import {Snip2xToken} from '#/schema/snip-2x-const';
	
	import {MsgSend} from '@solar-republic/cosmos-grpc/dist/cosmos/bank/v1beta1/tx';
	import BigNumber from 'bignumber.js';
	import {getContext, onDestroy} from 'svelte';
	import {slide} from 'svelte/transition';
	
	import {Screen, type Page} from './_screens';
	
	import {encode_proto} from '#/chain/cosmos-msgs';
	import type {SecretNetwork} from '#/chain/secret-network';
	import {global_receive} from '#/script/msg-global';
	import {NB_MAX_MEMO, XT_MINUTES} from '#/share/constants';
	import {subscribe_store} from '#/store/_base';
	import {Agents} from '#/store/agents';
	import {G_APP_STARSHELL} from '#/store/apps';
	import {Contracts} from '#/store/contracts';
	import {Entities} from '#/store/entities';
	import {QueryCache} from '#/store/query-cache';
	import {Settings} from '#/store/settings';
	import {CoinGecko} from '#/store/web-apis';
	import {fold} from '#/util/belt';
	import {buffer_to_base93, text_to_buffer} from '#/util/data';
	import {format_amount, format_fiat} from '#/util/format';
	import {
		yw_account,
		yw_account_ref,
		yw_chain,
		yw_chain_ref,
		yw_network,
		yw_owner,
	} from '##/mem';
	
	import AmountInput from '##/ui/AmountInput.svelte';
	import AssetSelect from '##/ui/AssetSelect.svelte';
	import CheckboxField from '##/ui/CheckboxField.svelte';
	import Field from '##/ui/Field.svelte';
	import Header from '##/ui/Header.svelte';
	
	import RequestSignature from './RequestSignature.svelte';
	import SettingsMemos from './SettingsMemos.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Notice from '../ui/Notice.svelte';
	import RecipientSelect from '../ui/RecipientSelect.svelte';
	import SenderSelect from '../ui/SenderSelect.svelte';
	
	import SX_ICON_PERSONAL from '#/icon/account_box.svg?raw';
	import SX_ICON_CONTRACT from '#/icon/analytics.svg?raw';
	import SX_ICON_LOADING from '#/icon/donut_large.svg?raw';
	import SX_ICON_DROPDOWN from '#/icon/drop-down.svg?raw';
	import SX_ICON_INFO from '#/icon/info.svg?raw';
	import SX_ICON_SHIELD from '#/icon/shield.svg?raw';
	import SX_ICON_VISIBILITY from '#/icon/visibility.svg?raw';
	

	const G_SLIDE_IN = {
		duration: 350,
		delay: 110,
	};

	const G_SLIDE_OUT = {
		duration: 150,
	};

	const k_page = getContext<Page>('page');

	/**
	 * Token to use for transfer (instead of native coin)
	 */
	export let assetPath: HoldingPath | ContractPath | '' = '';


	/**
	 * Address of initial receiver
	 */
	export let recipient: Bech32 | '' = '';
	let sa_recipient: Bech32 | '' = recipient;

	// address to contact lookup cache
	let h_addr_to_contact: Record<Chain.Bech32String, ContactPath>;


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

		// // replace cache
		// h_contacts = ofe(a_contacts);

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

	
	// let g_coin: CoinInfo | null = null;
	// let g_contract: ContractStruct | null = null;
	// let g_token: TokenStructDescriptor['snip20'] | null = null;

	// asset balance in lowest denomination
	let yg_balance: BigNumber | null = null;

	// asset balance in human-readable denomination
	let s_balance = '';

	// asset type
	let b_native = false;

	// native coin info
	let g_coin: CoinInfo | null = null;

	// contract struct
	let g_contract: ContractStruct | null;

	// asset properties
	let n_decimals = -1;

	// asset symbol
	let s_symbol = '';

	// coingecko id
	let si_coingecko = '';

	// amount that user intends to send
	let s_amount = '';

	// approx amount of fee padding to leave when using max
	let yg_fee_buffer_approx = BigNumber(0);


	// reactively compute the balance of the selected asset
	$: if(null !== yg_balance && n_decimals >= 0) {
		const yg_shifted: BigNumber = yg_balance.shiftedBy(-n_decimals);

		s_balance = format_amount(yg_shifted.toNumber());
	}

	async function update_asset() {
		b_use_max_native = false;

		g_coin = g_contract = null;

		// reset amount
		s_amount = '';

		// clear balance
		yg_balance = null;

		// indicate loading state
		s_balance = '[...]';

		// reset properties
		n_decimals = -1;
		s_symbol = '';
		si_coingecko = '';

		// reset fee buffer
		yg_fee_buffer_approx = BigNumber(0);

		// nothing
		if(!assetPath) return;

		// parse entity path
		const g_parsed = Entities.parseEntityPath(assetPath) || {};
		const s_entity_type = g_parsed['type'];

		// coin
		if('holding' === s_entity_type) {
			// set asset type
			b_native = true;

			// extract coin id from parsed holding path
			const si_coin = g_parsed['coin'] as string;

			// lookup coin info
			g_coin = $yw_chain.coins?.[si_coin];

			// update properties
			n_decimals = g_coin.decimals;
			s_symbol = si_coin;
			si_coingecko = g_coin.extra?.coingecko_id || '';

			// set fee buffer
			yg_fee_buffer_approx = BigNumber(12_000n+'');

			// start with the cached balacachedCoinBalancests
			const g_cached = $yw_network.cachedCoinBalance($yw_owner, si_coin);
			if(g_cached && g_cached.timestamp > Date.now() - (5 * XT_MINUTES)) {
				yg_balance = BigNumber(g_cached.data.amount);
			}

			// get the latest balance
			const g_bundle = await $yw_network.bankBalance($yw_owner, si_coin);
			if(g_bundle) {
				yg_balance = BigNumber(g_bundle.balance.amount);
			}
		}
		// token
		else if('contract' === s_entity_type) {
			// set asset type
			b_native = false;

			// load contract struct
			g_contract = await Contracts.at(assetPath as ContractPath);

			// token struct
			let g_token!: TokenStructDescriptor<'snip20'>['snip20'] | null;

			// secret-wasm; use snip-20 interface
			if($yw_chain.features.secretwasm) {
				g_token = g_contract?.interfaces.snip20 || null;
			}

			// token defined
			if(g_token) {
				// update properties
				n_decimals = g_token.decimals;
				s_symbol = g_token.symbol;
				si_coingecko = g_token.extra?.coingecko_id || '';

				// load query cache
				const ks_cache = await QueryCache.read();

				// start with the cached balance if it exists
				const g_cached = ks_cache.get($yw_chain_ref, $yw_owner, g_contract!.bech32);
				if(g_cached && g_cached.timestamp > Date.now() - (5 * XT_MINUTES)) {
					yg_balance = new BigNumber(g_cached.data.amount as string);
				}

				// get the latest balance
				const k_token = new Snip2xToken(g_contract!, $yw_network as SecretNetwork, $yw_account);

				const g_balance = await k_token.balance();
				if(g_balance) {
					yg_balance = new BigNumber(g_balance.balance.amount);
				}
			}
		}
	}


	$: {
		// react to account and asset changes
		if($yw_account && assetPath) {
			// go async
			queueMicrotask(update_asset);
		}
	}

	// apply the maximum amount the user can possibly send
	function use_max() {
		s_amount = (b_native
			? yg_balance?.minus(yg_fee_buffer_approx).shiftedBy(-n_decimals).toString()
			: yg_balance?.toString()
		) || '';

		if(b_native) {
			b_use_max_native = true;
		}

		c_show_validations++;
	}

	// reactively indicate whether the max is currently being used
	let b_use_max_native = false;
	$: b_using_max = BigNumber(s_amount).eq(s_balance) || b_native && b_use_max_native;


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

	// whether the user has enabled encryption
	let b_private_memo_enabled = false;
	let b_private_memo_published = false;
	let b_private_memo_recipient_published = false;

	let b_memo_expanded = false;
	let b_memo_private = false;
	let s_memo = '';

	// 
	{
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
	}



	// reactively fetch the worth of the asset
	let x_worth: number | null = null;
	let s_worth = '';
	const si_versus = 'usd';

	// coingecko id is set
	$: if(si_coingecko) {
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



	async function submit() {
		debugger;

		let g_msg!: Any;
		let gc_props: {
			fee?: FeeConfig;
			memo?: string;
		} = {};

		const s_amount_denom = BigNumber(s_amount).shiftedBy(n_decimals).toString();

		if(!b_form_valid) {
			c_show_validations++;
			return;
		}
		else if(b_native) {
			// TODO: support use max to send entire balance

			g_msg = {
				typeUrl: '/cosmos.bank.v1beta1.MsgSend',
				value: encode_proto(MsgSend, {
					fromAddress: $yw_owner,
					toAddress: sa_recipient,
					amount: [{
						amount: s_amount_denom,
						denom: g_coin!.denom,
					}],
				}),
			};

			// TODO: get gas limit from chain struct
			gc_props = {
				fee: {
					limit: 12_000n,
				} as FeeConfig,
			};


			// k_page.push({
			// 	creator: SendNative,
			// 	props: {
			// 		accountPath: $yw_account_ref,
			// 		coin: si_native,
			// 		recipient: sa_recipient,
			// 		amount: s_amount,
			// 		memoPlaintext: s_memo,
			// 		encryptMemo: (b_memo_private || (!s_memo.length && b_private_memo_enabled && b_private_memo_published)) && b_private_memo_recipient_published,
			// 		fee: x_fee+'',
			// 	},
			// });
		}
		else {
			// secret-wasm
			const g_secretwasm = $yw_chain.features.secretwasm;
			if(g_secretwasm) {
				const k_token = new Snip2xToken(g_contract!, $yw_network as SecretNetwork, $yw_account);

				const xg_transfer = BigInt(s_amount_denom);
				const g_prebuilt = await k_token.transfer(xg_transfer, sa_recipient as Bech32, s_memo);

				g_msg = g_prebuilt.proto;

				gc_props = {
					fee: {
						limit: g_secretwasm.snip20GasLimits.transfer,
					} as FeeConfig,
				};
			}
		}

		if(g_msg) {
			k_page.push({
				creator: RequestSignature,
				props: {
					...gc_props,
					protoMsgs: [g_msg],
					broadcast: {},
					local: true,
				},
				context: {
					chain: $yw_chain,
					accountPath: $yw_account_ref,
					app: G_APP_STARSHELL,
				},
			});
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

	function adjust_contract_settings() {
		// k_page.push({
		// 	creator: Snip,
		// 	context: {
		// 		intent: {
		// 			id: 'send_adjust_memo_settings',
		// 		},
		// 	},
		// });
	}

	// reactively update account if user switches in select
	let p_account_select: AccountPath = $yw_account_ref;
	$: if(p_account_select) {
		$yw_account_ref = p_account_select;
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
		title={b_native? 'Sending': 'Transferring'}
		postTitle={s_symbol}
		subtitle={$yw_chain?.name || '?'}
	/>

	<Field short
		key='sender-select'
		name='From'
	>
		<SenderSelect
			bind:accountPath={p_account_select}
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
		<AssetSelect bind:assetPath={assetPath} />
	</Field>

	<Field short
		key='amount'
		name='Amount'
	>
		<AmountInput
			disabled={null === yg_balance}
			bufferMax={b_native? 1: 0}
			assetPath={assetPath}
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
			{#if assetPath}
				<span class="balance">
					<span class="label">
						Balance
					</span>
					<span class="amount">
						{s_balance} {s_symbol}
					</span>
				</span>

				<span class="use-max">
					<span class="link" class:disabled={b_using_max} on:click={() => use_max()}>
						USE MAX
					</span>
				</span>
			{/if}
		</span>
	</Field>

	<hr>

	<div class="memo" class:expanded={b_memo_expanded}>
		<!-- svelte-ignore a11y-click-events-have-key-events -->
		<div class="title clickable" on:click={() => b_memo_expanded = !b_memo_expanded}>
			<span class="icon dropdown">
				{@html SX_ICON_DROPDOWN}
			</span>
			<span class="text">
				Add memo
			</span>

			{#if b_memo_expanded}
				{#if b_native}
					{#if b_private_memo_enabled && b_private_memo_recipient_published}
						<CheckboxField containerClass='encrypt' id='encrypted' bind:checked={b_memo_private}>
							Private
						</CheckboxField>
					{/if}
				{:else if g_contract?.interfaces.snip21}
					<CheckboxField containerClass='encrypt' id='encrypted' checked={true} disabled>
						Private
					</CheckboxField>
				{/if}
			{/if}
		</div>

		{#if b_memo_expanded}
			{#if b_native && !b_private_memo_enabled}
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
				{#if b_native}
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
				{:else if g_contract?.interfaces.snip21}
					<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
						<span class="global_svg-icon display_inline icon-diameter_18px" style="color:var(--theme-color-sky);">
							{@html SX_ICON_SHIELD}
						</span>
						<span class="text vertical-align_middle">
							This memo will be private, using the SNIP-21 interface.
						</span>
					</span>
				{:else}
					<span class="disclaimer" in:slide={G_SLIDE_IN} out:slide={G_SLIDE_OUT}>
						<span class="global_svg-icon display_inline icon-diameter_18px">
							{@html SX_ICON_VISIBILITY}
						</span>
						<span class="text vertical-align_middle">
							This memo will be public.&nbsp;&nbsp;<span class="link" on:click={() => adjust_contract_settings()}>{s_symbol} Settings</span>
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