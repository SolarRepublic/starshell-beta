<script lang="ts">
	import {createEventDispatcher, onMount} from 'svelte';

	const dispatch = createEventDispatcher();

	export let element: HTMLElement;

	let dm_anchor: HTMLSpanElement | undefined;

	onMount(() => {
		if(dm_anchor) {
			const dm_sibling = dm_anchor.nextElementSibling;
			dm_anchor.remove();

			dispatch('mount', dm_sibling);
		}
	});
</script>

{#if element?.outerHTML}
	<span class="anchor" bind:this={dm_anchor}></span>
	{@html element.outerHTML}
{/if}
