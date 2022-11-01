<script lang="ts">

	export let rootClasses = '';
	export let rootStyle = '';

	export let infoIcon = '';
	export let actionIcon = '';
</script>

<style lang="less">
	@import './_base.less';

	.resource-control {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: default;
		padding: 14px 0;

		.font(tiny);

		>.global_svg-icon {
			flex: 1;
			max-width: fit-content;

			&.info-icon {
				color: var(--theme-color-text-med);
			}

			&.action-icon {
				color: var(--theme-color-primary);
			}
		}

		>.info {
			flex: auto;
			max-width: calc(100% - 52px);
		}
	}
</style>

<hr class="no-margin">

<div class={`resource-control ${rootClasses}`} style={rootStyle} on:click>
	{#if infoIcon}
		<span class="global_svg-icon icon-diameter_16px info-icon">
			{@html infoIcon}
		</span>
	{/if}

	<span class="info">
		<slot />
	</span>

	{#if actionIcon}
		<span class="global_svg-icon icon-diameter_20px action-icon">
			{@html actionIcon}
		</span>
	{/if}
</div>