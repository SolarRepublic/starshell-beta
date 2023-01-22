<script lang="ts">
	import type {AccountPath, AccountStruct} from '#/meta/account';
	import type {FieldConfig} from '#/meta/field';
	import type {SecretStruct} from '#/meta/secret';
	
	import {yw_context_popup, yw_popup} from '../mem';
	import {load_page_context} from '../svelte';
	
	import {Bip39, XB_UNICODE_SPACE} from '#/crypto/bip39';
	import SensitiveBytes from '#/crypto/sensitive-bytes';
	import {Accounts} from '#/store/accounts';
	import {Secrets} from '#/store/secrets';
	import {buffer_to_text} from '#/util/data';
	
	import Screen from '../container/Screen.svelte';
	import SeedIdentity from '../frag/SeedIdentity.svelte';
	import PopupPin from '../popup/PopupPin.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
	import Fields from '../ui/Fields.svelte';
	import Header from '../ui/Header.svelte';
	import Row from '../ui/Row.svelte';
	


	const H_TARGET_GROUPS = {
		12: 3,
		15: 3,
		18: 2,
		21: 2,
		24: 2,
	};
	

	export let g_mnemonic: SecretStruct<'mnemonic'>;

	const p_mnemonic = Secrets.pathFrom(g_mnemonic);

	const {
		k_page,
	} = load_page_context();

	let a_subphrases: string[] = [];

	let i_visible = -1;

	let a_accounts: [AccountStruct, SecretStruct<'bip32_node'>][] = [];
	
	async function load_accounts() {
		for(const [, g_account] of await Accounts.entries()) {
			const p_secret = g_account.secret;

			const g_secret = await Secrets.metadata(p_secret);

			if('bip32_node' === g_secret.type) {
				if(p_mnemonic === g_secret.mnemonic) {
					a_accounts.push([
						g_account,
						g_secret,
					]);
				}
			}
		}

		// reactive assign
		a_accounts = a_accounts;
	}

	// let a_fields: FieldConfig[] = [];
	
	// async function load_accounts() {
	// 	const a_accounts: AccountPath[] = [];

	// 	for(const [p_account, g_account] of await Accounts.entries()) {
	// 		const p_secret = g_account.secret;

	// 		const g_secret = await Secrets.metadata(p_secret);

	// 		if('bip32_node' === g_secret.type) {
	// 			if(p_mnemonic === g_secret.mnemonic) {
	// 				a_accounts.push(p_account);
	// 			}
	// 		}
	// 	}

	// 	a_fields = [{
	// 		type: 'accounts',
	// 		label: 'This mnemonic derives the following accounts:',
	// 		paths: a_accounts,
	// 	}];
	// }

	(async function load() {
		void load_accounts();

		// decrypt mnemonic
		const atu8_package: Uint8Array = await new Promise((fk_resolve) => {
			// set context for pin popup
			$yw_context_popup = {
				seed: g_mnemonic.name,
				hint: g_mnemonic.security.hint,

				// test the pin entry
				enter: (atu8_pin: Uint8Array) => Secrets.borrow(p_mnemonic, async(kn_encrypted) => {
					// attempt to decrypt with pin
					try {
						fk_resolve(await Secrets.decryptWithPin(kn_encrypted.data, atu8_pin, g_mnemonic.security));
						return true;
					}
					catch(e_decrypt) {
						return false;
					}
				}),
			};

			// show popup
			$yw_popup = PopupPin;
		});

		// close popup
		$yw_popup = null;

		// decode mnemonic package
		const [atu8_extension, atu8_padded] = Bip39.decodePackage(atu8_package);

		// trim padded mnemonic
		const kn_trimmed = Bip39.trimPaddedMnemonic(new SensitiveBytes(atu8_padded));

		// ref raw mnemonic text
		const atu8_mnemonic = kn_trimmed.data;

		// create word split index list and count number of words
		const atu8_splits: Uint8Array = new Uint8Array(24);
		let c_words = 0;
		{
			let ib_write = 0;
			for(let ib_offset=0; ;) {
				// find start of next word
				const ib_next = atu8_mnemonic.indexOf(XB_UNICODE_SPACE, ib_offset) + 1;

				// no more words
				if(!ib_next) break;

				// increment word count
				c_words += 1;

				// add index to splits
				atu8_splits[ib_write++] = ib_offset = ib_next;
			}
		}

		// divide mnemonic into subphrases
		{
			const n_words_per_subphrase = Math.ceil(c_words / (H_TARGET_GROUPS[c_words] || 2));
			let ib_read = 0;
			let i_split = n_words_per_subphrase;
			for(;;) {
				// find next split
				const ib_next = atu8_splits[i_split];

				// no more splits; done
				if(!ib_next) break;

				// advance split pointer
				i_split += n_words_per_subphrase;

				// set subphrase
				a_subphrases.push(buffer_to_text(atu8_mnemonic.subarray(ib_read, ib_next)));

				// advance read pointer
				ib_read = ib_next;
			}
		}

		// wipe sensitive data
		kn_trimmed.wipe();

		// reactive assign
		a_subphrases = a_subphrases;
	})();


	function done() {
		k_page.pop();
	}
</script>


<Screen>
	<Header plain pops
		title="Export mnemonic seed"
	/>

	<div>
		<SeedIdentity s_nickname={g_mnemonic.name} />
	</div>

	<p>
		This mnemonic derives the following accounts:
	</p>


	<!-- <Field key="accounts" name="This mnemonic derives the following accounts"> -->
		{#each a_accounts as [g_account, g_bip32_node]}
			<Row pfpDim={36}
				rootStyle='border:none; padding:0;'
				resource={g_account}
				detail={g_bip32_node.bip44}
			/>
		{/each}
	<!-- </Field> -->
		
	<!-- <Fields configs={a_fields} /> -->

	<hr class="no-margin">

	{#each a_subphrases as s_subphrase, i_subphrase}
		<Field name="Seed phrase part {i_subphrase+1} of {a_subphrases.length+1}">
			{#if i_visible === i_subphrase}
				<textarea readonly
					value={s_subphrase}
					on:blur={() => i_visible = -1}
				/>
			{:else}
				<textarea readonly
					value={'*'.repeat(128)}
					on:focus={() => i_visible = i_subphrase}
				/>
			{/if}
		</Field>
	{/each}

	<ActionsLine confirm={['Done', done]} />
</Screen>