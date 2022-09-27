<script context="module" lang="ts">
	const c_screens = 0;
</script>

<script lang="ts">
	import {yw_blur, yw_curtain, yw_help, yw_nav_collapsed, yw_nav_visible, yw_overscroll_pct, yw_progress} from '#/app/mem';

	import type {Page} from '../screen/_screens';

	import {createEventDispatcher, getContext, onMount} from 'svelte';

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

	const si_exit = leaves? 'leaves': swipes? 'swipes': '';

	const dispatch = createEventDispatcher();
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

		dispatch('dom', dm_screen);

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
					}
					catch(e_null) {}
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

		// this was previously part of the form, move it out so that form children can use full relative height
		overflow: hidden;
		&.scroll {
			overflow-y: scroll;
			overscroll-behavior-y: contain;
			.hide-scrollbar();

			&.curtained {
				overflow-y: hidden;
			}
		}
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
		height: auto;

		min-height: 100%;

		// not necessary
		// @media screen and (max-width: 500px) {
		// 	min-height: calc(100% - 70px);
		// 	padding-bottom: 70px;
		// }

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
				:global(&:not(.no-flex)) {
					flex: 0;
				}

				:global(&:not(.no-margin)) {
					margin: 0 var(--ui-padding);
				}
			}
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

		>*:not(.no-blur) {
			:global(&) {
				transition: filter 400ms var(--ease-out-cubic);
			}
		}

		&.blur {
			>*:not(.no-blur) {
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

	}

</style>
<!-- class:slides={slides} -->

<div class="bounds"
	class:slides={b_slides}
	class:scroll={true}
>
	<form
		class="screen {classNames}"
		class:flex={true}
		class:nav={b_nav}
		class:progress={progress}
		class:transparent={transparent}
		class:sublimate={false}
		class:blur={$yw_blur}
		class:curtained={$yw_curtain}
		data-s2-exit={si_exit}
		bind:this={dm_screen}
		on:submit={(d_event) => {
			void d_event.preventDefault();
		}}
		on:submit
		style="{style}"
		autocomplete="off"
	>
		<slot></slot>
	</form>
</div>
