<script lang="ts">
	export let element: HTMLElement;
</script>

{#if element?.outerHTML}
	{@html element.outerHTML}
{/if}
