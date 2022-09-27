<script lang="ts">
	import type {Account, AccountPath} from '#/meta/account';
	import type {Bech32} from '#/meta/chain';
	import type {Contact} from '#/meta/contact';
	import {NB_MAX_MEMO} from '#/share/constants';
	import {Accounts} from '#/store/accounts';
	import {Agents} from '#/store/agents';
	import {Chains} from '#/store/chains';
	import {CoinGecko} from '#/store/web-apis';
	import {base93_to_buffer, buffer_to_text, text_to_buffer} from '#/util/data';
	import {format_fiat} from '#/util/format';
	import BigNumber from 'bignumber.js';

	import {getContext} from 'svelte';
	import {syserr} from '../common';
	import {ThreadId} from '../def';
	import {yw_chain, yw_navigator, yw_network_active, yw_network_ref} from '../mem';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Address from '../ui/Address.svelte';
	import Field from '../ui/Field.svelte';
	import {Screen, Header, type Page} from './_screens';
	import MemoReview from '../ui/MemoReview.svelte';
	import type {Vocab} from '#/meta/vocab';
	import type {IntraExt} from '#/script/messages';
	import {compileMemoPlaintext, ecdhNonce} from '#/crypto/privacy';

	const k_page = getContext<Page>('page');

	const d_service: Vocab.TypedRuntime<IntraExt.ServiceInstruction> = chrome.runtime;

	/**
	 * Native coin id
	 */
	export let coin: string;
	const si_coin = coin;

	const g_coin = $yw_chain.coins[si_coin];

	export let accountRef: AccountPath;
	let g_account: Account['interface'];
	let sa_sender: Bech32;

	export let amount: string;
	const s_amount = amount;

	export let recipient: Bech32;
	const sa_recipient = recipient;

	export let encryptMemo = false;
	const b_memo_encrypted = encryptMemo;

	let s_memo_publish = '';
	let s_memo_encrypted = '';

	let s_recipient_title = '';

	let g_contact: Contact['interface'] | null;

	export let fee: string;
	const s_fee = fee;

	$: s_total = new BigNumber(s_amount).plus(fee).toString();

	export let memoPlaintext: string;

	let x_worth = 0;

	const xg_limit = 20_000n;
	const x_price = 0.25;

	(async(fk_resolve) => {
		const si_coingecko = g_coin.extra?.coingecko_id || '';

		if(si_coingecko) {
			const h_versus = await CoinGecko.coinsVersus([si_coingecko], 'usd', 0);
			x_worth = h_versus[si_coingecko];
		}
	})();

	(async() => {
		const ks_accounts = await Accounts.read();

		g_account = ks_accounts.at(accountRef)!;
		sa_sender = Chains.addressFor(g_account.pubkey, $yw_chain);

		const p_contact = Agents.pathForContactFromAddress(sa_recipient);
		g_contact = await Agents.getContact(p_contact);

		s_recipient_title = g_contact?.name || '';

		if(b_memo_encrypted) {
			// encode memo
			const atu8_memo_in = text_to_buffer(memoPlaintext);

			// exceeds length
			if(atu8_memo_in.byteLength > NB_MAX_MEMO) {
				throw syserr({
					title: 'Invalid Memo',
					text: 'Your memo text exceeds the character limitation for private memos',
				});
			}

			// prepare the plaintext buffer
			const atu8_plaintext = new Uint8Array(NB_MAX_MEMO);
			atu8_plaintext.set(atu8_memo_in, 0);

			// locate recipient's public key
			let atu8_pubkey_65: Uint8Array;
			try {
				({
					pubkey: atu8_pubkey_65,
				} = await $yw_network_active.e2eInfoFor(sa_recipient));
			}
			catch(e_info) {
				throw syserr({
					title: 'Recipient Account Unpublished',
					error: e_info,
				});
			}

			// produce e2e nonce
			let s_sequence: string;
			try {
				({
					sequence: s_sequence,
				} = await $yw_network_active.e2eInfoFor(sa_sender));
			}
			catch(e_info) {
				throw syserr({
					title: 'Invalid Account for Private Memos',
					error: e_info,
				});
			}

			const atu8_nonce = await ecdhNonce(`${BigInt(s_sequence) + 1n}`, `${xg_limit}`);

			const atu8_ciphertext = await $yw_network_active.ecdhEncrypt(atu8_pubkey_65, atu8_plaintext, atu8_nonce);

			s_memo_publish = s_memo_encrypted = compileMemoPlaintext(atu8_ciphertext);

			// simulate decryption
			{
				if(!s_memo_encrypted.startsWith('🔒1')) throw new Error(`Failed to verify encrypted memo prefix`);
				const atu8_published = base93_to_buffer(s_memo_encrypted.slice(3));

				const atu8_decrypted = await $yw_network_active.ecdhDecrypt(atu8_pubkey_65, atu8_published, atu8_nonce);

				const s_memo_decrypted = buffer_to_text(atu8_decrypted).replace(/\0+$/, '');
				if(s_memo_decrypted !== memoPlaintext) {
					throw new Error(`Simulated decrypted memo did not match original: ${s_memo_decrypted}`);
				}
			}
		}
	})();

	async function approve() {
		const xg_amount = BigInt(new BigNumber(s_amount).shiftedBy(g_coin.decimals).toString());

		const i_timeout = setTimeout(() => {
			syserr({
				title: 'Service worker is inactive',
				text: 'Your browser is preventing StarShell from waking the background thread.',
			});
		}, 2e3);

		// send wake instruction
		await d_service.sendMessage({
			type: 'wake',
		});

		// instruct service worker to complete send
		void d_service.sendMessage({
			type: 'bankSend',
			value: {
				network: $yw_network_ref,
				sender: sa_sender,
				recipient: sa_recipient,
				coin: si_coin,
				amount: `${xg_amount}`,
				limit: `${xg_limit}`,
				price: x_price,
				memo: s_memo_publish,
			},
		}).then(() => {
			// cancel timeout
			clearTimeout(i_timeout);

			// reset page
			k_page.reset();

			// activate history thread
			void $yw_navigator.activateThread(ThreadId.HISTORY);
		});
	}

</script>

<style lang="less">
	@import './_base.less';

	.title {

	}

	.subtitle {
		.font(tiny);
		color: var(--theme-color-text-med);
	}

	.empty-memo {
		.font(tiny);
		font-style: italic;
		color: var(--theme-color-text-med);
	}
</style>

<Screen debug='SendNative' slides>
	<Header pops exits
		on:close={() => k_page.reset()}
		title='Sending'
		symbol={si_coin}
		subtitle={$yw_chain.name}
	/>

	<Field short
		key='sender'
		name='From'
	>
		<div class="title">
			{g_account?.name || '[...]'}
		</div>

		<div class="subtitle">
			{g_account?.extra?.total_fiat_cache || '(?)'}
		</div>
	</Field>

	<hr>

	<Field short
		key='recipient'
		name='To'
	>
		<div class="title">
			{s_recipient_title || '[...]'}
		</div>

		<div class="subtitle">
			<Address address={sa_recipient} />
		</div>
	</Field>

	<hr>

	<Field short
		key='amount'
		name='Amount'
	>
		<div class="title">
			{s_amount} {si_coin}
		</div>

		<div class="subtitle">
			{#if x_worth}
				{format_fiat(new BigNumber(s_amount).times(x_worth).toNumber())}
			{:else}
				=[...]
			{/if}
		</div>
	</Field>

	<hr>
	
	<Field short
		key='fee-review'
		name='Fee'
	>
		<div class="title">
			{s_fee} {si_coin}
		</div>

		<div class="subtitle">
			{#if x_worth}
				{format_fiat(new BigNumber(s_fee).times(x_worth).toNumber())}
			{:else}
				=[...]
			{/if}
		</div>
	</Field>

	<hr>
	
	<Field short
		key='total'
		name='Total'
	>
		<div class="title">
			{s_total || '[...]'} {si_coin}
		</div>

		<div class="subtitle">
			{#if x_worth}
				{format_fiat(new BigNumber(s_total).times(x_worth).toNumber())}
			{:else}
				=[...]
			{/if}
		</div>
	</Field>

	<hr>
	
	<MemoReview
		memoPlaintext={memoPlaintext}
		memoCiphertext={s_memo_encrypted}
	/>

	<ActionsLine back confirm={['Approve', () => approve()]} />

</Screen>
