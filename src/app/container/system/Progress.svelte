<script>
	import { yw_progress } from '##/mem';

	$: x_width_pct_bar = ($yw_progress[0] / $yw_progress[1]) * 100;
</script>

<style lang="less">
	@import '../../../style/util.less';

	.progress {
		--bar-height: 4px;
		z-index: 1001;
		background-color: black;
		position: absolute;
		height: var(--bar-height);
		top: calc(0px - var(--bar-height));
		left: 0;
		width: 100%;
		transition: top 0.2s var(--ease-out-cubic);

		&.visible {
			top: 0;
		}

		>.bar {
			background-color: var(--theme-color-primary);
			height: 100%;
			width: 0%;
			transition: width 1s var(--ease-out-cubic);
		}
	}

	.step {
		.font(tiny);
		color: var(--theme-color-text-med);

		z-index: 1001;

		position: absolute;
		top: calc(0px - var(--ui-padding));
		left: 0;
		// left: calc(0px - (var(--app-window-width) * 0.25));
		
		margin-top: var(--ui-padding);
		margin-left: var(--ui-padding);
		
		opacity: 0;
		transition: all 0.6s var(--ease-out-cubic);
		transition-delay: 0.4s;

		&.visible {
			// left: 0;
			top: 0;
			opacity: 1;
		}
	}
</style>


<div class="progress" class:visible={$yw_progress[0] > 0}>
	<div class="bar" style="width: {x_width_pct_bar}%;"></div>
</div>

<div class="step" class:visible={$yw_progress[0] > 0}>
	Step {$yw_progress[0] || $yw_progress[1]} of {$yw_progress[1]}
</div>
