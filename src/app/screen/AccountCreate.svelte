<script lang="ts">
	import {onMount} from 'svelte';
	
	import {Screen, Header} from './_screens';
	import {load_page_context} from '../svelte';
	
	import CreateWallet from './CreateWallet.svelte';
	import ActionsWall from '../ui/ActionsWall.svelte';

	const {k_page} = load_page_context();

	// TODO: remove auto-push to allow selecting between creation modes
	onMount(() => {
		setTimeout(() => {
			k_page.push({
				creator: CreateWallet,
			});
		}, 20);
	});

</script>

<style lang="less">
	@import '../_base.less';

	.hd-path {
		:global(&) {
			.font(tiny);
			color: var(--theme-color-text-med);
		}
	}
</style>

<Screen slides>
	<Header pops
		title="Add account"
	>
	</Header>

	<hr>

	<p>
		Create a new account, import an existing one, or connect to a hardware wallet.
	</p>

	<ActionsWall>
		<button class="primary" on:click={() => k_page.push({
			creator: CreateWallet,
		})}>
			Create new StarShell account
		</button>
<!-- 
		<button on:click={() => k_page.push({
			creator: DeadEnd,
		})}>
			Import with private key
		</button>

		<button on:click={() => k_page.push({
			creator: DeadEnd,
		})}>
			Connect to hardware
		</button> -->
	</ActionsWall>
</Screen>