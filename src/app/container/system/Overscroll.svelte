<script lang="ts">
	import {
		yw_overscroll_pct,
	} from '##/mem';

	let dm_progress: SVGCircleElement;

	// $: {
	// 	dm_progress.style.$yw_overscroll_pct
	// }
</script>


<style lang="less">
	svg {
		display: none;
		z-index: 20001;
		position: absolute;
		top: 10px;
		left: calc(50% - 16px);

		.progress {
			stroke-dasharray: 62;
			stroke-dashoffset: 62;
			stroke-linecap: round;
			transition: stroke-dasharray 100ms linear;
		}
	}
</style>


<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" class="overscroll">
	<style lang="less">
		.overscroll {
			.bg {
				fill: var(--theme-color-text-light);
			}
			
			.ring {
				fill: transparent;
				stroke: #c4c4c4;
			}

			.progress {
				fill: transparent;
				stroke: black;
			}
		}
	</style>

	<circle cx="16" cy="16" r="16" class="bg" />

	<circle cx="16" cy="16" r="10" class="ring" stroke-width="3" style="opacity:0.2;" />

	<circle cx="16" cy="16" r="10" class="progress" stroke-width="3" style="stroke-dashoffset:{62 - ($yw_overscroll_pct * 62)}" bind:this={dm_progress} />
	
	<!-- <path d="M16 16 A16 6 {xa_pct} {xa_pct}" class="s2r-overflow-fg" /> -->
</svg>