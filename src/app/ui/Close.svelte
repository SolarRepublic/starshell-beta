<script lang="ts">
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';

	export let absolute = false;
	export let heightless = false;
</script>

<style lang="less">
	.close {
		position: relative;
		top: 0;
		right: 0;
		margin: var(--margin, 10px);
		padding: 12px;
		cursor: pointer;
		--icon-diameter: 24px;
		--icon-color: var(--theme-color-primary);

		outline: 1px solid var(--theme-color-border);
		border-radius: 0px;
		transition: border-radius 650ms var(--ease-out-expo);
		pointer-events: all;

		// margin-top: calc(0px - (var(--ui-padding) * 0.75));
		// margin-right: calc(0px - (var(--ui-padding) * 0.75));

		&.absolute {
			position: absolute;
		}

		&::before {
			--occlusion-thickness: 4px;

			content: '';
			position: absolute;
			top: calc(var(--occlusion-thickness) / 2);
			left: calc(var(--occlusion-thickness) / 2);
			width: calc(100% - var(--occlusion-thickness));
			height: calc(100% - var(--occlusion-thickness));
			outline: var(--occlusion-thickness) solid var(--theme-color-bg);
			box-sizing: border-box;
			pointer-events: none;
		}

		&:hover {
			border-radius: 22px;
		}
	}
</style>

<div class="close icon" class:absolute={absolute} on:click>
	{@html SX_ICON_CLOSE}
</div>
