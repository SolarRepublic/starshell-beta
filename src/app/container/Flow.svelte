
<style lang="less">
	.viewport {
		.full(relative);
		overflow: hidden;

		color: var(--theme-color-text-light);
		background-color: var(--theme-color-bg);

		>.content {
			.full(relative);
			overflow: hidden;

			width: 100%;
			height: 100%;

			&.exitting {
				position: absolute;
				top: 0;
				z-index: 1001;
				user-select: none;
				pointer-events: none;
			}

			>.thread {
				:global(&) {
					.full(absolute);
				}
			}
	
			// :global(&>section) {
			// 	position: absolute;
			// 	top: 0px;
			// 	transition: left 0.6s var(--ease-out-quick);
			// }
		}
	}
</style>

<main class="viewport" bind:this={dm_viewport}>

</main>