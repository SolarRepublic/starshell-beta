<script context="module" lang="ts">
	let c_screens = 0;
</script>

<script lang="ts">
	import { arrival, yw_blur, yw_help, yw_nav_collapsed, yw_nav_visible, yw_overscroll_pct, yw_progress } from '#/app/mem';

	import type { Page } from '../screen/_screens';

	import { timeout } from '#/util/belt';
	import { createEventDispatcher, getContext, onMount } from 'svelte';

	export let nav = false;
	const b_nav = nav;

	export let debug = '';
	export let progress: null | [number, number] = null;
	export let full = false;
	export let keyed = false;
	export let classNames = '';


	const k_page = getContext<Page>('page');

	export let leaves = false;
	export let swipes = false;
	export let root = 0 === k_page.index;
	export let slides = !leaves && !swipes && !root;
	const b_slides = slides;

	export let form = false;
	const b_form = !!form;

	export let transparent = false;

	let dm_screen: HTMLElement;

	// @mvp
	let dm_help: HTMLElement | null = null;

	const si_exit = leaves? 'leaves': swipes? 'swipes': '';

	const dispatchEvent = createEventDispatcher();
	onMount(() => {
		if(!k_page) {
			console.warn(`${debug || 'unknown'} Screen missing page context`);
		}
		else {
			// listen for page events
			k_page.on({
				// on page focus
				focus() {
					// set nav visibility
					$yw_nav_visible = b_nav;
				},
			});
		}

		// // scrolling
		// dm_screen.addEventListener('wheel', (de_wheel) => {
		// 	// overscroll
		// 	if(0 === dm_screen.scrollTop) {
		// 		if(de_wheel.DOM_DELTA_PIXEL === de_wheel.deltaMode) {
		// 			// const x_delta_y = de_wheel.deltaY;
		// 			// const x_pct = Math.min(Math.abs(x_delta_y), 50) / 50;
		// 			// $yw_overscroll_pct = x_pct;
		// 			// console.log((x_pct * 100).toFixed(2));

		// 			// console.log({
		// 			// 	deltaY: de_wheel.deltaY,
		// 			// 	// wheelDeltaY: de_wheel.wheelDeltaY,
		// 			// 	screenY: de_wheel.screenY,
		// 			// 	mode: de_wheel.deltaMode,
		// 			// });
		// 		}
		// 	}
		// });

		// arrival(dm_screen, () => {
		// 	console.log('arrived to screen');
		// 	$yw_nav_visible = nav;
		// 	// $yw_nav_collapsed = !nav;

		// 	// if(nav) {
		// 	// 	$yw_nav_visible = true;
		// 	// }

		// 	if(progress) {
		// 		$yw_progress = progress;
		// 	}

		// 	$yw_help = dm_help
		// 		? Array.from(dm_help.cloneNode(true).childNodes) as HTMLElement[]
		// 		: [];

		// 	dispatchEvent('arrive');
		// });

		// if screen has keyed svelte components
		if(keyed) {
			let x_scroll_top = 0;

			// svelte will replace those elements when changing screens
			(new MutationObserver(async(a_mutations) => {
				// keyed component was removed
				if(a_mutations[0]?.addedNodes.length) {
					try {
						x_scroll_top = dm_screen.scrollTop;
					} catch(e_null) {}
				}
				// keyed component was restored
				else if(a_mutations[0]?.removedNodes.length) {
					if(dm_screen) {
						dm_screen.scrollTop = x_scroll_top;
					}
				}
			})).observe(dm_screen, {
				childList: true,
			});
		}
	});

	export let style = '';
</script>

<style lang="less">
	@import '../../style/util.less';

	div.bounds {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		padding-left: calc(50vw - (var(--app-max-width) / 2));
	}

	.slides {
		transform: translateX(calc(var(--app-window-width) / 2));
		transition: transform 0.6s var(--ease-out-quick);
	}

	@media(prefers-reduced-motion) {
		.slides {
			transition: none 0s linear;
		}
	}

	section.screen,form.screen {
		position: relative;
		max-width: var(--app-max-width);
		top: 0;
		left: 0;

		box-sizing: border-box;

		width: 100%;
		height: 100%;

		.font(regular);

		background-color: var(--theme-color-bg);

		opacity: 1;
		filter: blur(0);

		// transition: transform 0.6s var(--ease-out-quick);

		&.transparent {
			background-color: transparent;
		}

		&.progress {
			padding-top: 22px;
		}

		&.nav {
			padding-bottom: 71px;
		}

		&.flex {
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: var(--gap, var(--ui-padding));

			>:first-child:not(.no-margin) {
				:global(&) {
					margin-top: var(--ui-padding);
				}
			}

			&>* {
				:global(&) {
					flex: 0;
				}

				:global(&:not(.no-margin)) {
					margin: 0 var(--ui-padding);
				}
			}
		}

		overflow: hidden;
		&.scroll {
			overflow-y: scroll;
			overscroll-behavior-y: contain;
			.hide-scrollbar();
		}

		// &.slides {
		// 	transform: translateX(calc(var(--app-window-width) / 2));
		// 	transition: transform 0.6s var(--ease-out-quick);
		// }

		&.slid {
			transition: transform 0.5s var(--ease-out-cubic);
		}

		&[data-s2-exit]:not([data-s2-exit='']) {
			:global(&) {
				// left: 0;
				transform: translateX(0px);
				transition: transform 0.5s var(--ease-out-quint);
			}
		}

		@keyframes fade-away {
			0% {
				opacity: 1;
			}

			75% {
				opacity: 0;
			}

			100% {
				opacity: 0;
			}
		}

		@keyframes blur-away {
			0% {
				filter: blur(0);
			}

			100% {
				filter: blur(14px);
			}
		}

		@keyframes scale-up {
			0% {
				transform: scale(1);
			}

			100% {
				transform: scale(1.75);
			}
		}

		// @keyframes sublimate {
		// 	0% {
		// 		opacity: 1;
		// 		transform: scale(1);
		// 		filter: blur(0);
		// 	}

		// 	25% {
		// 		filter: blur(14px);
		// 	}

		// 	80% {
		// 		opacity: 0;
		// 	}

		// 	100% {
		// 		transform: scale(1.75)
		// 	}
		// }

		@keyframes turn-away {
			0% {
				transform: perspective(0px) rotateY(0deg);
			}

			1% {
				transform: perspective(1500px) rotateY(0deg);
			}

			100% {
				transform: perspective(1500px) rotateY(-80deg);
			}
		}

		@keyframes fade-out {
			0% {
				opacity: 1;
			}

			10% {
				opacity: 1;
			}

			80% {
				opacity: 0;
			}

			100% {
				opacity: 0;
			}
		}

		&.sublimate {
			// animation: 
			// 	scale-up 1000ms var(--ease-out-cubic) forwards,
			// 	fade-away 1000ms var(--ease-out-quad) forwards,
			// 	blur-away 200ms var(--ease-out-quad) forwards;

			// --mimic: 1000ms var(--ease-out-quint) forwards;
			// animation: turn-away var(--mimic),
			// 	fade-out var(--mimic);
			// transform-origin: 120%;

			transition: opacity 400ms var(--ease-out-quad);
			opacity: 0;
		}

		&.materialize {

		}

		>*:not(.header) {
			:global(&) {
				transition: filter 400ms var(--ease-out-cubic);
			}
		}

		&.blur {
			>*:not(.header) {
				:global(&) {
					filter: blur(2px);
				}
			}
		}



		/*
			Copied from screen.less
		*/
		* {
			:global(&) {
				font-family: inherit;
				user-select: none;
			}
		}

		.text:not(button .text):not(.row .text) {
			:global(&) {
				user-select: text;
				cursor: default;
			}
		}

		input,textarea {
			:global(&) {
				user-select: initial;
			}
		}

		.validation-message {
			:global(&) {
				.font(tiny);
				color: var(--theme-color-caution);
				text-align: right;
				width: 100%;

				padding-top: 3px;
				margin-left: -9px;
				display: inline-block;
			}
		}

		.user-select_all {
			:global(&) {
				user-select: all;
			}
		}

		.actions-wall, .actions-line {
			button {
				:global(&) {
					min-height: var(--ui-row-height);
					max-height: var(--ui-row-height);
					
					color: var(--theme-color-text-light);
					border: 1px solid var(--theme-color-border);

					border-radius: var(--ui-border-radius);

					transition: background-color 1s var(--ease-out-expo),
						color 2s var(--ease-out-quick);
				}

				&.primary {
					:global(&) {
						color: var(--theme-color-text-dark);
						background-color: var(--theme-color-primary);
					}

					&:disabled,&[readonly="true"] {
						:global(&) {
							color: var(--theme-color-text-med);
							background-color: var(--theme-color-border);
							cursor: not-allowed;
							opacity: 0.4;
						}
					}
				}
			}
		}

		button {
			:global(&) {
				background-color: var(--theme-color-bg);
				cursor: pointer;
			}

			&.pill {
				:global(&) {
					.font(regular, @size: 11px, @weight: 500);
					margin: 0;
					padding: 0.4em 1em;
					color: var(--theme-color-primary);
					border: 1px solid var(--theme-color-primary);
					border-radius: 400em;
				}
			}
		}

		h3 {
			:global(&) {
				font-weight: 500;
				margin: 0;
			}
		}

		.action-wall {
			:global(&) {
				display: flex;
				flex-direction: column;
				justify-content: space-evenly;
				gap: var(--ui-padding);
			}

			&>button {
				:global(&) {
					flex: 1;
				}
			}
		}

		p {
			:global(&) {
				.font(regular, @weight: 300);
			}
		}

		.form-entry() {
			:global(&) {
				width: 100%;
				height: var(--ui-row-height);
				box-sizing: border-box;
				padding-left: var(--ui-padding);

				border-radius: var(--ui-border-radius);
				background-color: var(--theme-color-border);
				color: var(--theme-color-text-light);
				border: 1px solid transparent;

				font-weight: 300;
			}

			&::placeholder {
				:global(&) {
					font-weight: 300;
					// color: rgb(117,117,117);
					color: var(--theme-color-text-med);
					opacity: 0.7;
				}
			}

			&:focus {
				:global(&) {
					outline: 1px solid var(--theme-color-primary);
				}
			}
		}

		input {
			:global(&) {
				font-size: inherit;
			}

			&[type="text"],&[type="password"],&[type="number"] {
				.form-entry();
			}

			&.invalid:not(:focus) {
				:global(&) {
					border: 1px solid var(--theme-color-caution) !important;
				}
			}

			&.address {
				:global(&) {
					.font(mono-tiny);
					letter-spacing: 0.25px;
				}
			}
		}

		.selectContainer.invalid {
			input {
				:global(&) {
					border: 1px solid var(--theme-color-caution) !important;
				}
			}
		}

		textarea {
			.form-entry();

			:global(&) {
				.font(regular);

				padding: 1ex 2ex;
				height: 10.75ex;
			}
		}


		.flex-rows {
			:global(&) {
				display: flex;
				flex-direction: column;
				align-items: stretch;
				gap: var(--ui-padding);
			}

			&>* {
				:global(&) {
					flex: 0;
					margin-top: 0;
					margin-bottom: 0;
				}
			}
		}

		.font-variant_mono {
			:global(&) {
				.font(mono);
			}
		}

		.font-variant_mono-tiny {
			:global(&) {
				.font(mono-tiny);
			}
		}

		.color-icon-send {
			:global(&) {
				--svg-color-fg: var(--theme-color-orange);
			}
		}

		.color-icon-recv {
			:global(&) {
				--svg-color-fg: var(--theme-color-slime);
			}
		}

		.link {
			:global(&) {
				color: var(--theme-color-primary);
				cursor: pointer;
			}

			&:hover {
				:global(&) {
					text-decoration: underline;
				}
			}
		}

		.svelte-tabs {
			>ul.svelte-tabs__tab-list {
				:global(&) {
					display: flex;
					justify-content: stretch;

					margin-left: calc(0px - var(--ui-padding));
					margin-right: calc(0px - var(--ui-padding));
					border-bottom: 1px solid var(--theme-color-border);
				}

				>li.svelte-tabs__tab {
					:global(&) {
						flex: 1;
						text-align: center;

						color: var(--theme-color-graymed);
						border-bottom: 2px solid transparent;
						padding: 12px 0.75em;
					}

					&.svelte-tabs__selected {
						:global(&) {
							color: var(--theme-color-primary);
							border-bottom: 2px solid var(--theme-color-primary);
						}
					}
				}
			}

			>div.svelte-tabs__tab-panel {
				:global(&) {
					margin-top: var(--ui-padding);
				}
			}
		}
	}

</style>
<!-- class:slides={slides} -->

<div class="bounds"
	class:slides={b_slides}
>
	<form
		class="screen {classNames}"
		class:flex={true}
		class:scroll={true}
		class:nav={b_nav}
		class:progress={progress}
		class:transparent={transparent}
		class:sublimate={false}
		class:blur={$yw_blur}
		data-s2-exit={si_exit}
		bind:this={dm_screen}
		on:submit={d_event => void d_event.preventDefault()}
		on:submit
		style="{style}"
		autocomplete="off"
	>
		<slot></slot>

		{#if 'help' in $$slots}
			<div class="display_none" bind:this={dm_help}>
				<slot name="help" />
			</div>
		{/if}
	</form>
</div>
