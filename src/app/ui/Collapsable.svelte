<script lang="ts">
	import SX_ICON_DROPDOWN from '#/icon/drop-down.svg?raw';

	/**
	 * Sets the title for the collapsable section
	 */
	export let title: string;
	const s_title = title;

	/**
	 * Exposed binding of the expanded state
	 */
	export let expanded = false;

	/**
	 * Injects class names into the container element
	 */
	export let classNames = '';
	const s_classes = classNames;

</script>

<style lang="less">
	@import './_base.less';

	.collapsable {
		padding-top: var(--ui-padding);
		padding-bottom: var(--ui-padding);
		border-top: 1px solid var(--theme-color-border);

		&:last-child {
			border-bottom: 1px solid var(--theme-color-border);
		}

		>.title {
			display: flex;
			gap: 4px;
			position: relative;

			.dropdown.icon {
				--icon-diameter: 22px;
				--icon-color: var(--theme-color-primary);
	
				transform: rotate(0deg);
				transition: transform 300ms var(--ease-out-quad);
			}
		}

		&.expanded {
			.dropdown.icon {
				transform: rotate(-180deg);
			}
		}
	}

</style>


<div class="collapsable {s_classes}" class:expanded={expanded}>
	<div class="title clickable" on:click={() => expanded = !expanded}>
		<span class="icon dropdown">
			{@html SX_ICON_DROPDOWN}
		</span>
		<span class="text">
			{s_title}
		</span>
	<!-- 
		{#if b_expanded}
			<span class="disclaimer" transition:slide={{duration:350, delay:400}}>
				Caution: Memos are NOT private
			</span>
		{/if} -->
	</div>

	{#if expanded}
		<slot />
	{/if}
</div>
