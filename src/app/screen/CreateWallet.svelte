<script lang="ts">
	import {Header, Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {create_mnemonic} from '#/share/account';
	
	import {open_external_link} from '#/util/dom';
	
	import AccountEdit from './AccountEdit.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';


	const {k_page} = load_page_context();

	/**
	 * Expose binding for agree checkbox
	 */
	export let b_agreed = false;

	// lock the ui while busy
	let b_busy = false;

	// create a new wallet and account
	async function create_new_wallet() {
		// lock the ui
		b_busy = true;

		// go to mnemonic screen
		

		// create new account
		const p_account = await create_mnemonic();

		// proceed to account edit screen
		k_page.push({
			creator: AccountEdit,
			props: {
				accountPath: p_account,
				fresh: true,
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
				I agree to the <span class="link" on:click={() => open_external_link('https://starshell.net/tac.html')}>Terms and Conditions</span>.
			</CheckboxField>
		</div>

		<button class="primary" disabled={!b_agreed || b_busy} on:click={() => create_new_wallet()}>
			Create new StarShell wallet
		</button>
	</ActionsWall>
</Screen>