<script lang="ts">
	import {
		slide as svelte_slide,
		type SlideParams,
		type TransitionConfig,
	} from 'svelte/transition';

	export let name = "";
	export let key: string;

	/**
	 * Set to true to render the field on a single row
	 */
	export let short = false;

	export let slides = false;
	export let double = false;

	// interface AutoConfig {
	// 	fn: (node: Element, { delay, duration, easing }?: SlideParams) => TransitionConfig;
	// 	config: TransitionConfig;
	// }

	// function auto(dm_node: HTMLElement, gc_auto: {}): TransitionConfig {
	// 	if(slide) {
	// 		return svelte_slide(dm_node, {
	// 			duration: 500,
	// 		});
	// 	}

	// 	return void 0 as unknown as TransitionConfig;
	// }
	
</script>

<style lang="less">
	@import './_base.less';

	.field {
		align-items: center;

		.field-name {
			margin-bottom: 10px;
			color: var(--theme-color-text-med);

			font-size: 13px;
			font-weight: 300;
		}

		.field-value {
			.font(regular);
			color: var(--theme-color-text-light);
		}

		&.short {
			display: flex;

			>.field-name {
				flex: 1;
				margin-bottom: 0;
			}

			>.field-value {
				flex: 3;
				width: 0;
			}
		}
	}
</style>

<div class="field" class:short={short} id="field-{key}" class:double={double}>
	<div class="field-name" transition:svelte_slide={{duration:slides? 350: 0}}>
		<label for="{key}">{name}</label>
	</div>

	<div class="field-value" transition:svelte_slide={{duration:slides? 350: 0}}>
		<slot></slot>
	</div>

	<slot name="post" />
</div>