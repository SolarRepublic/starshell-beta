<script context="module" lang="ts">

</script>

<script lang="ts">
import { logout } from "#/share/auth";

	import { onMount } from "svelte";

	let s_status = '';

	async function attempt_logout() {
		await logout();

		s_status = 'Done';
	}
</script>

<style lang="less">
	
</style>

<div>
	Already logged in.

	<button on:click={() => attempt_logout()}>
		Log out
	</button>

	{s_status}
</div>
