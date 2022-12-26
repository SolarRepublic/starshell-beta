<script lang="ts">
	import {Header, Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {open_external_link} from '#/util/dom';
	
	import WalletCreate from './WalletCreate.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';
	import CheckboxField, {toggleChildCheckbox} from '../ui/CheckboxField.svelte';


	const {k_page} = load_page_context();

	/**
	 * Expose binding for agree checkbox
	 */
	export let b_agreed = false;

	function agree_tos() {
		k_page.push({
			creator: WalletCreate,
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

		<button class="primary" disabled={!b_agreed || b_busy} on:click={() => agree_tos()}>
			Continue
		</button>
	</ActionsWall>
</Screen>