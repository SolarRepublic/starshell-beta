<script lang="ts">
	import {yw_account_ref, yw_network_active} from '##/mem';
	import type {Account, AccountInterface, AccountPath, UtilityKeyType} from '#/meta/account';
	import type {Pfp, PfpTarget} from '#/meta/pfp';
	import type {Resource} from '#/meta/resource';
	import {Accounts} from '#/store/accounts';
	import {Secrets} from '#/store/secrets';
	import {base64_to_buffer, buffer_to_base64, buffer_to_base93, buffer_to_text, deserialize_private_key, serialize_private_key, sha256_sync, text_to_buffer, zero_out} from '#/util/data';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';
	import {Header, Screen} from './_screens';

	import {Secp256k1Key} from '#/crypto/secp256k1';
	import type {Secret, SecretPath} from '#/meta/secret';
	import AccountEdit from './AccountEdit.svelte';
	import {Incidents} from '#/store/incidents';
	import {uuid_v4} from '#/util/dom';
	import RuntimeKey from '#/crypto/runtime-key';
	import {bip39EntropyToPaddedMnemonic, bip39MnemonicToSeed, trimPaddedMnemonic} from '#/crypto/bip39';
	import {Bip32, bip32MasterKey} from '#/crypto/bip32';
	import type {Bip44Path} from '#/crypto/bip44';
	import SensitiveBytes from '#/crypto/sensitive-bytes';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import {load_page_context} from '../svelte';
	import {Chains} from '#/store/chains';
	import {ATU8_SHA256_STARSHELL} from '#/share/constants';


	const {k_page} = load_page_context();

	export let reset = false;

	export let b_agreed = false;

	async function create_account(p_secret: SecretPath<'bip32_node' | 'private_key'>, s_pubkey: string, p_pfp: PfpTarget): Promise<[AccountPath, AccountInterface]> {
		// open accounts store and save new account
		const p_account = await Accounts.open(ks_accounts => ks_accounts.put({
			family: 'cosmos',
			pubkey: s_pubkey,
			secret: p_secret,
			name: 'Citizen 1',
			utilityKeys: {},
			pfp: p_pfp,
		}));

		// verify account was created
		let g_account: AccountInterface;
		{
			const ks_accounts = await Accounts.read();
			const g_test = ks_accounts.at(p_account);

			if(!g_test) {
				throw new Error(`Failed to access account immediately after creating it`);
			}

			g_account = g_test;
		}

		// create event
		await Incidents.record({
			type: 'account_created',
			data: {
				account: p_account,
			},
		});

		return [p_account, g_account];
	}

	async function create_private_key() {
		// generate new private key
		const [kk_sk, k_secp] = await Secp256k1Key.generatePrivateKey(true);

		// generate new uuid for the secret
		const s_uuid = uuid_v4();

		// save private key to secrets store
		const p_secret = await kk_sk.access(atu8_sk => Secrets.put(atu8_sk, {
			type: 'private_key',
			name: 'Auto-generated private key for beta',
			uuid: s_uuid,
			security: {
				type: 'none',
			},
		})) as SecretPath<'private_key'>;

		// export public key
		const atu8_pk = k_secp.exportPublicKey();

		// 
		const [p_account, g_account] = await create_account(p_secret, buffer_to_base64(atu8_pk), '');

		// set account
		$yw_account_ref = p_account;
	}

	function bip32_test_signature(k_node: Bip32): Promise<string> {
		return k_node.privateKey.access(async(atu8_sk) => {
			// create runtime key for secp256k1 instance
			const kk_sk = await RuntimeKey.createRaw(atu8_sk);

			// import private key
			const k_secp = await Secp256k1Key.import(kk_sk);

			// sign some arbitrary piece of data
			const atu8_signature = await k_secp.sign(ATU8_SHA256_STARSHELL);

			// serialize
			return buffer_to_base64(atu8_signature);
		});
	}

	async function create_mnemonic(): Promise<AccountPath> {
		// HD derivation path
		const sx_hd_path: Bip44Path = `m/44'/529'/0'/0/0`;

		// // test
		// const kn_entropy_test = new SensitiveBytes(Uint8Array.from(new Array(32).fill(1)));

		const kn_entropy = SensitiveBytes.random(32);

		// create new mnemonic
		const kn_padded = await bip39EntropyToPaddedMnemonic(kn_entropy);

		const s_mnemonic_padded = buffer_to_base93(kn_padded.data);

		console.log({
			s_mnemonic_padded,
			data: kn_padded.data,
			text: buffer_to_text(kn_padded.data),
		});

		const [atu8_mnemonic, sx_otp_mnemonic] = serialize_private_key(kn_padded.clone());

		// save padded mnemonic to secrets store
		const p_secret_mnemonic = await Secrets.put(atu8_mnemonic, {
			type: 'mnemonic',
			uuid: crypto.randomUUID(),
			hint: '',
			name: 'Mnemonic Key for Beta',
			security: {
				type: 'otp',
				data: sx_otp_mnemonic,
			},
		}) as Resource.Path<Secret<'mnemonic'>>;

		// zero it out
		zero_out(atu8_mnemonic);


		// trim padded mnemonic
		const kn_trimmed = trimPaddedMnemonic(kn_padded);

		console.log({
			kn_trimmed: kn_trimmed.data,
		});

		// mnemonic passphrase
		const atu8_passphrase = text_to_buffer('');

		// generate 512-bit seed key
		const kk_seed = await bip39MnemonicToSeed(() => kn_trimmed.data, () => Uint8Array.from(atu8_passphrase));

		// prep signing verification
		let s_signature_before = '';

		// prep public key
		let atu8_pk33!: Uint8Array;

		// derive account
		const p_secret_node = await kk_seed.access(async(atu8_seed) => {
			// create master node from seed
			const k_master = await bip32MasterKey(() => atu8_seed);

			// traverse to given node
			const k_node = await k_master.derivePath(sx_hd_path);

			// copy out compressed public key
			atu8_pk33 = k_node.publicKey.slice();

			// create a signature to verify the node gets serialized and stored correctly
			s_signature_before = await bip32_test_signature(k_node);

			// serialize node
			const kn_node = await k_node.serializeNode();

			// create otp in order to avoid serializing the raw node as a string
			const [atu8_xor_node, sx_otp_node] = serialize_private_key(kn_node);

			// compeletely destroy the whole bip32 tree
			k_node.obliterate();

			// create private key secret
			return await Secrets.put(atu8_xor_node, {
				type: 'bip32_node',
				uuid: crypto.randomUUID(),
				mnemonic: p_secret_mnemonic,
				bip44: sx_hd_path,
				name: `Private key at ${sx_hd_path} for the mnemonic ${p_secret_mnemonic}`,
				security: {
					type: 'otp',
					data: sx_otp_node,
				},
			}) as SecretPath<'bip32_node'>;
		});

		// test the node was serialized and stored correctly
		{
			// access private node
			(await Secrets.borrowPlaintext(p_secret_node, async(kn_node, g_secret) => {
				// import as bip32 node
				const k_node = await Bip32.import(kn_node);

				// signatures do no match
				if(s_signature_before !== await bip32_test_signature(k_node)) {
					// obliterate the node
					k_node.obliterate();

					// error
					throw new Error(`Failed to produce matching signatures for BIP-0032 node after round-trip serialization.`);
				}

				console.debug(`Confirmed matching signatures: ${s_signature_before}`);
			}))!;
		}

		// console.log({
		// 	data: base64_to_buffer(g_secret_sk.data),
		// 	base64: g_secret_sk.data,
		// 	pubkey: atu8_pk,
		// 	pubkey_64: buffer_to_base64(atu8_pk),
		// });

		// create account using new seed
		const [p_account, g_account] = await create_account(p_secret_node, buffer_to_base64(atu8_pk33), '');

		// initialize
		await add_utility_key(g_account, 'transactionEncryptionKey', 'secretWasmTx');
		await add_utility_key(g_account, 'antiPhishingArt', 'antiPhishingArt');

		return p_account;
	}

	async function add_utility_key(g_account: AccountInterface, si_use: string, si_utility: UtilityKeyType) {
		// intentionally not ADR-036 because apps should not be able to propose these messages
		let atu8_ikm: Uint8Array;
		{
			// get account's signing key
			const k_key = await Accounts.getSigningKey(g_account);

			// custom starshell data to be signed
			const g_doc_starshell = {
				type: 'StarShell:scopedSignature',
				use: si_use,
				scope: {
					caip2: 'cosmos:pulsar-2',
				},

				// sign using "secret" as bech32 hrp
				signer: Chains.addressFor(g_account.pubkey, 'secret'),
			};

			// serialize doc to buffer
			const atu8_bytes = text_to_buffer(JSON.stringify(g_doc_starshell));

			// sign as buffer
			const atu8_signature = await k_key.sign(atu8_bytes);

			// hash the signature to produce 32-bit ikm
			atu8_ikm = sha256_sync(atu8_signature);
		}

		// import key
		const dk_sig = await crypto.subtle.importKey('raw', atu8_ikm, 'HKDF', false, ['deriveBits']);

		// use hkdf to derive utility key
		const ab_utility_key = await crypto.subtle.deriveBits({
			name: 'HKDF',
			hash: 'SHA-256',
			salt: ATU8_SHA256_STARSHELL,
			info: new Uint8Array(0),
		}, dk_sig, 256);

		// create tx encryption key secret
		const p_secret_tx: SecretPath = await Secrets.put(new Uint8Array(ab_utility_key), {
			type: 'private_key',
			name: 'Auto-generated private key for beta',
			uuid: uuid_v4(),
			security: {
				type: 'none',
			},
		});

		// update account cache
		g_account.utilityKeys = {
			...g_account.utilityKeys,
			[si_utility]: p_secret_tx,
		};

		// add key to account
		return await Accounts.open(ks => ks.put(g_account));
	}

	let b_busy = false;

	async function create_new_wallet() {
		b_busy = true;

		const p_account = await create_mnemonic();

		k_page.push({
			creator: AccountEdit,
			props: {
				accountPath: p_account,
				oneway: true,
			},
		});
	}
</script>

<style lang="less">
	.agree-tos {
		text-align: left;
	}

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

	<ActionsWall>
		<div class="agree-tos" on:click={toggleChildCheckbox}>
			<CheckboxField id="" bind:checked={b_agreed}>
				I agree to the <a href="https://starshell.net/tac.html">Terms and Conditions</a>.
			</CheckboxField>
		</div>

		<button class="primary" disabled={!b_agreed || b_busy} on:click={() => create_new_wallet()}>
			Create new StarShell wallet
		</button>
	</ActionsWall>
</Screen>