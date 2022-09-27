<script lang="ts">
	import PfpGenerator from "../ui/PfpGenerator.svelte";
	import { Screen } from "./_screens";

	export let preset: string;

	let i_offset = 0;
</script>

<style lang="less">
	
</style>

<Screen debug="Debug">
	Debug: {preset}

	{#if 'pfp-gen' === preset}
		<div>
			<PfpGenerator bind:offset={i_offset} />
		</div>

		<button class="pill" on:click={() => i_offset++}>
			Next
		</button>
	{/if}
</Screen>
