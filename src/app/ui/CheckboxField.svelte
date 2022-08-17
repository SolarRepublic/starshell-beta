<script lang="ts">
	import { F_NOOP } from '#/util/belt';

	import SX_ICON_CHECKED from '#/icon/checked.svg?raw';
	import SX_ICON_UNCHECKED from '#/icon/unchecked.svg?raw';

	/**
	 * HTML element id
	 */
	export let id: string;
	const s_id = id;

	/**
	 * Sets the class of the fieldset container element
	 */
	export let containerClass = '';

	/**
	 * Exposed binding of the checked value
	 */
	export let checked = false;

	export let disableHandler = false;

	// export let stopLabelClicks = false;
	// const b_text_propagates = !stopLabelClicks;

	// console.log({
	// 	b_text_propagates,
	// });

	function handle_field_click(d_event) {
		// ignore label click propagations
		if('LABEL' !== d_event.target.tagName) {
			// all others
			if(!disableHandler) {
				checked = !checked;
			}
		}

		// stop propagation
		d_event.stopImmediatePropagation();
	}
</script>

<style lang="less">
	fieldset {
		display: flex;
		gap: 8px;
		margin: 0;
		padding: 0;
		border: 0;

		.checkbox {

			.icon {
				--icon-diameter: 18px;
				--icon-color: var(--theme-color-primary);
				vertical-align: middle;
			}
		}
	}
</style>


<fieldset class="{containerClass}" on:click={handle_field_click}>
	<span class="checkbox">
		<input id={s_id} type="checkbox" hidden bind:checked={checked}>
		<span class="icon">
			{@html checked? SX_ICON_CHECKED: SX_ICON_UNCHECKED}
		</span>
	</span>

	{#if $$slots.default}
		<label for={s_id}>
			<slot />
		</label>
	{/if}
</fieldset>