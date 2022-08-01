<script lang="ts">
	import { getContext } from 'svelte';

	import {
		Screen,
		Header,
		type Page,
	} from './_screens';

	import type {AccountPath} from '#/meta/account';
	import AccountEdit from './AccountEdit.svelte';

	const k_page = getContext<Page>('page');

</script>

<style lang="less">
	@import './_base.less';

	.hd-path {
		:global(&) {
			.font(tiny);
			color: var(--theme-color-text-med);
		}
	}
</style>

<Screen nav slides>
	<Header pops
		title="Add account"
	>
	</Header>

	<hr>

	<p>
		Create a new account, import an existing one, or connect to a hardwarware wallet.
	</p>

	<div class="action-wall">
		<button class="primary" on:click={() => k_page.push({
			creator: AccountEdit,
		})}>
			Create new StarSehll account
		</button>

		<button on:click={() => k_page.push({
			creator: DeadEnd,
		})}>
			Import with private key
		</button>

		<button on:click={() => k_page.push({
			creator: DeadEnd,
		})}>
			Connect to hardware
		</button>
	</div>
</Screen>