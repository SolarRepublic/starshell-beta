<script lang="ts">
	import type {Bech32} from '#/meta/chain';

	import Address from '../ui/Address.svelte';
	import Copyable from '../ui/Copyable.svelte';
	import ResourceControl from '../ui/ResourceControl.svelte';
	import {qs} from '#/util/dom';

	import SX_ICON_AT from '#/icon/at.svg?raw';
	import SX_ICON_COPY from '#/icon/copy.svg?raw';
	import type { Promisable } from '#/meta/belt';
	import Load from '../ui/Load.svelte';

	export let address: Promisable<Bech32>;

	function resource_click(d_event: MouseEvent) {
		const dm_target = d_event.target as HTMLElement;
		const dm_control = dm_target.closest('.resource-control')!;
		const dm_copyable = qs(dm_control, '.copyable')! as HTMLElement;
		dm_copyable.click();
	}
</script>

<ResourceControl infoIcon={SX_ICON_AT} actionIcon={SX_ICON_COPY} on:click={resource_click}>
	{#await address}
		<Load forever />
	{:then sa_resource}
		<Copyable output={sa_resource} confirmation="Address copied!" let:copy>
			<Address address={sa_resource} on:click={() => copy(sa_resource)} />
		</Copyable>
	{/await}
</ResourceControl>
