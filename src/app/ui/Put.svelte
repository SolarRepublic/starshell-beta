<script lang="ts">
	export let element: HTMLElement;

	// let dm_render: HTMLElement;

	// $: if(dm_render && element) {
	// 	for(const g_attr of element.attributes) {
	// 		dm_render.setAttribute(g_attr.name, g_attr.value);
	// 	}

	// 	const a_children = [].slice.apply(element.children) as HTMLElement[];

	// 	dm_render.replaceChildren(...a_children);
	// }
</script>

{#if element?.outerHTML}
	<!-- <svelte:element data-put={`${element.tagName}:: ${element.outerHTML}`} this={element.tagName} bind:this={dm_render} /> -->
	{@html element.outerHTML}
{/if}
