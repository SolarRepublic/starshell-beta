<script lang="ts">
	import {Header, Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {create_mnemonic} from '#/share/account';
	
	import AccountEdit from './AccountEdit.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';


	const {k_page} = load_page_context();

	export let reset = false;

	export let b_agreed = false;

	let b_busy = false;

	async function create_new_wallet() {
		b_busy = true;

		const p_account = await create_mnemonic();

		// // create test account
		// {
		// 	// generate new uuid for the secret
		// 	const s_uuid = uuid_v4();

		// 	const s_mnemonic = 'phrase suffer love decide sword bridge arch work miss wheat foil sudden ';
		// 	const kn_trimmed = new SensitiveBytes(text_to_buffer(s_mnemonic));

		// 	const atu8_passphrase = text_to_buffer('');

		// 	// generate 512-bit seed key
		// 	const kk_seed = await bip39MnemonicToSeed(() => kn_trimmed.data, () => Uint8Array.from(atu8_passphrase));

		// 	// prep signing verification
		// 	let s_signature_before = '';

		// 	const sx_hd_path = `m/44'/529'/0'/0/0`;

		// 	// prep public key
		// 	let atu8_pk33!: Uint8Array;

		// 	// derive account
		// 	const p_secret_node = await kk_seed.access(async(atu8_seed) => {
		// 		// create master node from seed
		// 		const k_master = await bip32MasterKey(() => atu8_seed);

		// 		// traverse to given node
		// 		const k_node = await k_master.derivePath(sx_hd_path);

		// 		// copy out compressed public key
		// 		atu8_pk33 = k_node.publicKey.slice();

		// 		// create a signature to verify the node gets serialized and stored correctly
		// 		s_signature_before = await bip32_test_signature(k_node);

		// 		// serialize node
		// 		const kn_node = await k_node.serializeNode();

		// 		// create otp in order to avoid serializing the raw node as a string
		// 		const [atu8_xor_node, sx_otp_node] = serialize_private_key(kn_node);

		// 		// compeletely destroy the whole bip32 tree
		// 		k_node.obliterate();

		// 		// create private key secret
		// 		return await Secrets.put(atu8_xor_node, {
		// 			type: 'bip32_node',
		// 			uuid: crypto.randomUUID(),
		// 			mnemonic: p_secret_mnemonic,
		// 			bip44: sx_hd_path,
		// 			name: `Private key at ${sx_hd_path} for the mnemonic ${p_secret_mnemonic}`,
		// 			security: {
		// 				type: 'otp',
		// 				data: sx_otp_node,
		// 			},
		// 		}) as SecretPath<'bip32_node'>;


		// 	const atu8_sk = base64_to_buffer('');
		// 	const k_secp = await Secp256k1Key.import(await RuntimeKey.createRaw(atu8_sk));

		// 	// save private key to secrets store
		// 	const p_secret = Secrets.put(atu8_sk, {
		// 		type: 'private_key',
		// 		name: 'Auto-generated private key for beta',
		// 		uuid: s_uuid,
		// 		security: {
		// 			type: 'none',
		// 		},
		// 	});

		// 	// export public key
		// 	const atu8_pk = k_secp.exportPublicKey();

		// 	// 
		// 	const [p_account, g_account] = await create_account(p_secret, buffer_to_base64(atu8_pk), '');
		// }

		k_page.push({
			creator: AccountEdit,
			props: {
				accountPath: p_account,
				fresh: true,
				oneway: true,
			},
		});
	}

	let b_advanced_showing = false;
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
<!-- 
	<Collapsable bind:expanded={b_advanced_showing} title={`${b_advanced_showing? 'Hide': 'Show'} Advanced Options`}>
		<Field key="account-path" name="Derivation path (BIP44)">
			<InputBip44 bip44="m/44'/529'/0'/0/0" />
		</Field>
	</Collapsable> -->

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