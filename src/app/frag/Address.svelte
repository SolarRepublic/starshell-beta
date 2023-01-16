<script lang="ts">
	import {onMount} from 'svelte';

	import {syserr} from '##/common';
	
	import SX_ICON_COPY from '#/icon/copy.svg?raw';


	/**
	 * human-readable part
	 */
	export let prefix = '';

	/**
	 * address part
	 */
	export let address: string;

	/**
	 * If `true`, display copy icon and binds to click events
	 */
	export let copyable: boolean | string = false;

	/**
	 * If `true`, hides copy icon
	 */
	export let discreet = false;

	const b_copyable = !!copyable;
	const s_copy_style = copyable? discreet? 'no-icon': 'icon': copyable || '';


	let b_copy_confirm = false;
	async function copy() {
		// attempt to perform copy
		try {
			await navigator.clipboard.writeText(address);
		}
		// unable to use clipboard
		catch(e_write) {
			syserr({
				title: 'Browser API Failure',
				text: 'Failed to write to the navigator clipboard.',
				error: e_write,
			});

			return;
		}

		b_copy_confirm = true;
		setTimeout(() => {
			b_copy_confirm = false;
		}, 800);
	}

	// bind to head element
	let dm_head: HTMLElement;

	// set true when head overflows
	let b_head_overflows = false;

	onMount(() => {
		b_head_overflows = dm_head.scrollWidth > dm_head.offsetWidth;
	});
</script>

<style lang="less">
	@import '../_base.less';

	.address {
		.fill-available();

		align-items: baseline;

		color: var(--theme-color-text-med);
		display: inline-flex;
		position: relative;

		&.copyable {
			align-items: center;
			width: calc(100% - 0.5ch);
			cursor: copy;
		}

		>.prefix {
			.font(tiny);
			flex-shrink: 0;
			margin-right: 0.25em;
		}

		>.head {
			.font(mono-tiny);
			flex: auto;
			min-width: 10ch;
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		}

		>.tail {
			.font(mono-tiny);
			flex: 0;
			min-width: 7ch;
			overflow: hidden;

			display: flex;
			justify-content: flex-end;
			white-space: nowrap;
		}

		>.copy {
			color: var(--theme-color-primary);

			&.icon {
				--icon-diameter: 22px;
				--icon-color: var(--theme-color-primary);
				padding-left: 6px;
			}
		}

		>.copied {
			opacity: 0;
			position: absolute;
			left: calc(50% - 40px);
			top: -6px;
			color: var(--theme-color-black);
			border-radius: 6px;
			padding: 8px 20px;
			background-color: var(--theme-color-text-light);
			box-shadow: -2px 3px 6px;
			pointer-events: none;

			&:not(.confirm) {
				transition: opacity 800ms linear;
			}

			&.confirm {
				opacity: 1;
			}
		}
	}
</style>

<span class="address" class:copyable={b_copyable} on:click|stopPropagation={b_copyable? () => copy(): void 0}>
	{#if prefix}
		<span class="prefix">
			{prefix}
		</span>
	{/if}
	<span class="head" bind:this={dm_head}>
		{address}
	</span>
	<span class="tail" class:display_none={!b_head_overflows}>
		{address}
	</span>

	{#if b_copyable}
		{#if 'icon' === s_copy_style}
			<span class="copy icon">
				{@html SX_ICON_COPY}
			</span>
		{:else if 'no-icon' !== s_copy_style}
			<span class="copy">
				Copy
			</span>
		{/if}

		<span class="copied" class:confirm={b_copy_confirm}>
			Copied!
		</span>
	{/if}
</span>
