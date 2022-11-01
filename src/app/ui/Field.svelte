<script lang="ts">
	import {uuid_v4} from '#/util/dom';

	import {
		slide as svelte_slide,
	} from 'svelte/transition';

	export let name = '';
	export let key = uuid_v4();

	export let rootStyle = '';

	/**
	 * Set to true to render the field on a single row
	 */
	export let short = false;

	/**
	 * Sets the field value to align center vertically
	 */
	export let simple = false;

	export let slides = false;
	export let double = false;

	export let unlabeled = false;

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
		align-items: end;
		gap: 14px;

		&.simple {
			margin-bottom: 0 !important;

			>.field-name {
				margin-bottom: 0;
			}
		}

		>.field-name {
			// margin-bottom: 0.5em;
			color: var(--theme-color-text-med);

			font-size: 13px;
			font-weight: 300;
			margin-bottom: 0.5em;
		}

		>.field-value {
			.font(regular, @size: 13px);
			color: var(--theme-color-text-light);
			// overflow-x: scroll;  // this messes up svelte-select

			&.hide-scrollbar {
				scrollbar-width: none;
			
				&::-webkit-scrollbar {
					width: 0;
					height: 0;
					background: transparent;
				}
			}
		}

		&.long {
			>.field-name {
				display: flex;
				align-items: center;
				justify-content: space-between;
			}
		}

		&.short {
			align-items: start;
			display: flex;
			margin-bottom: 0.5em;

			&.simple {
				align-items: center;
			}

			>.field-name {
				flex: 1;
				margin-bottom: 0;
				white-space: nowrap;
			}

			>.field-value {
				flex: 3;
				width: 0;
			}
		}
	}
</style>


<div class="field" id="field-{key}"
	class:double={double}
	class:simple={simple} 
	class:short={short}
	class:long={!short}
	style={rootStyle}
>
	{#if (name || short) && !unlabeled}
		<div class="field-name" transition:svelte_slide={{duration:slides? 350: 0}}>
			<label for="{key}">{name}</label>

			<slot name="right"></slot>
		</div>
	{/if}

	<div class="field-value" transition:svelte_slide={{duration:slides? 350: 0}} class:hide-scrollbar={true}>
		<slot></slot>
	</div>

	<slot name="post" />
</div>