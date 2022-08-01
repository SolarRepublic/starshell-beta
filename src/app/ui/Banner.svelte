<script context="module" lang="ts">
	export type DisplayConfig = {
		image: string;
		text?: string;
	};
</script>

<script lang="ts">

	export let display: DisplayConfig;
	const g_display = display;

	export let exits = false;
	const b_exits = exits;

</script>

<style lang="less">
	@import './_base.less';

	.backdrop {
		background-color: black;
		width: 100%;
		height: 172px;

		display: flex;

		&>.img {

		}

		&>.text {
			.font(regular);
			color: var(--theme-color-text-light);
		}
	}
</style>

<div class="backdrop">
	{#if g_display.image}
		<div class="img">
			<img src={g_display.image} alt={g_display.text || ''} />
		</div>
	{/if}

	{#if g_display.text}
		<div class="text">
			{g_display.text}
		</div>
	{/if}
</div>
