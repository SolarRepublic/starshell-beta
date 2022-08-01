<script lang="ts">
	import {yw_account_ref} from '##/mem';
	import type { Account, AccountPath } from '#/meta/account';
	import type { Pfp, PfpPath } from '#/meta/pfp';
	import type { Resource } from '#/meta/resource';
	import { Accounts } from '#/store/accounts';
	import { Secrets } from '#/store/secrets';
	import { ode } from '#/util/belt';
	import { buffer_to_base64, buffer_to_string8 } from '#/util/data';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import CheckboxField from '../ui/CheckboxField.svelte';
	import { Header, Screen } from './_screens';

	import { Secp256k1Key } from '#/crypto/secp256k1';
	import type { Secret, SecretPath } from '#/meta/secret';
	import AccountEdit from './AccountEdit.svelte';
	import { Events } from '#/store/events';


	export let reset = false;

	export let b_agreed = false;

	async function create_account(p_secret: SecretPath, sa_owner: string, p_pfp: PfpPath): Promise<AccountPath> {
		// open accounts store and save new account
		const p_account = await Accounts.open(ks_accounts => ks_accounts.put({
			family: 'cosmos',
			pubkey: sa_owner,
			secret: p_secret,
			name: 'Citizen 1',
			pfp: p_pfp,
		}));

		// create event
		await Events.insert({
			type: 'account_created',
			time: Date.now(),
			data: {
				account: p_account,
			},
		});

		return p_account;
	}

	async function create_private_key() {
		// generate new private key
		const [kk_sk, k_secp] = await Secp256k1Key.generatePrivateKey(true);

		// generate new uuid for the secret
		const s_uuid = crypto.randomUUID();

		// save private key to secrets store
		const p_secret = await Secrets.open(async ks => ks.put({
			type: 'private_key',
			data: await kk_sk.access(atu8_sk => buffer_to_string8(atu8_sk)),
			name: 'Auto-generated private key for beta',
			uuid: s_uuid,
			security: {
				type: 'none',
			},
		}));

		// export public key
		const atu8_pk = k_secp.exportPublicKey();

		// 
		const p_account = await create_account(p_secret, buffer_to_base64(atu8_pk), '');

		// set account
		$yw_account_ref = p_account;
	}
	// async function create_seed() {
	// 	// create new mnemonic
	// 	const kn_padded = await bip39EntropyToPaddedMnemonic(SensitiveBytes.random(32));

	// 	// save padded mnemonic to secrets store
	// 	await Secrets.open(ks => ks.add({
	// 		type: 'mnemonic',
	// 		data: buffer_to_string8(kn_padded.data),
	// 		hint: '',
	// 		name: 'Mnemonic Key for Beta',
	// 		uuid: crypto.randomUUID(),
	// 		security: {
	// 			type: 'none',
	// 		},
	// 	}));

	// 	// trim padded mnemonic
	// 	const kn_trimmed = trimPaddedMnemonic(kn_padded);

	// 	// generate seed
	// 	const kk_seed = await bip39MnemonicToSeed(() => kn_trimmed.data, () => Uint8Array.from([]));


	// 	// derive account
	// 	const y_bip32 = BIP32Factory(ecc);
	// 	await kk_seed.access((atu8_seed) => {
	// 		const y_master = y_bip32.fromSeed(atu8_seed as Buffer);
	// 		const sx_bip44: Bip44Path = `m/44'/529'/0'/0/0`;
	// 		y_master.derivePath(sx_bip44).privateKey;
	// 	});

	// 	// create account using new seed
	// 	await create_account();
	// }
</script>

<style lang="less">
	.icon {
		padding-top: 25%;
	}
</style>

<Screen>
	<Header
		title="Create a new wallet"
	/>

	<p>
		This software is currently in beta. Since it has not undergone security audits, importing and exporting of mnemonics and private keys is forbidden.
	</p>

	<p>
		This means you will not be able to backup seed phrases, private keys, or use hardware wallets.
	</p>

	<p>
		All transactions take place on a test network.
	</p>

	<CheckboxField id="" bind:checked={b_agreed}>
		By checking this box, you agree to the <a href="https://starshell.net/tac.html">Terms and Conditions</a>.
	</CheckboxField>

	<ActionsLine confirm={['Create new StarShell wallet', create_private_key, !b_agreed]} contd={{
		creator: AccountEdit,
		props: {
			account: $yw_account_ref,
		},
	}} />

</Screen>