<script lang="ts">
	import type {JsonObject} from '#/meta/belt';
	import type {AdaptedStdSignDoc} from '#/schema/amino';
	
	import {JsonView} from '@zerodevx/svelte-json-view';
	
	import {Screen} from './_screens';
	import {load_page_context} from '../svelte';
	
	import {F_NOOP} from '#/util/belt';
	import {base64_to_buffer} from '#/util/data';
	
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Header from '../ui/Header.svelte';
	

	const {k_page} = load_page_context();

	export let amino: AdaptedStdSignDoc | null = null;

	export let wasm: JsonObject;
</script>

<style lang="less">
	@import '../_base.less';
	
	.code-title {
		margin-bottom: calc(0px - (var(--ui-padding) / 2));
	}

	.raw-json {
		height: fit-content;
		flex: none;
	
		background-color: fade(@theme-color-graydark, 50%);
		color: var(--theme-color-text-light);
		overflow: scroll;
		padding: 1em;
		border-radius: 4px;
		.font(mono-tiny);
		margin-bottom: var(--ui-padding);

		padding-bottom: 0;
	}
</style>

<Screen>
	<Header title='View Data' exits on:close={() => k_page.pop()} />
	{#if wasm}
		<div class="code-title">
			Unencrypted Contract Message
		</div>
		<div class="raw-json textarea no-flex">
			<JsonView
				--nodeColor='var(--theme-color-text-light)'
				json={wasm}
			/>
		</div>

		<div class="code-title">
			Encrypted Message Size
		</div>
		<textarea>{base64_to_buffer(amino?.msgs[0].value.msg+'').byteLength} bytes</textarea>
	{/if}

	<div class="code-title">
		Transaction
	</div>
	<div class="raw-json textarea no-flex">
		<JsonView
			--nodeColor='var(--theme-color-text-light)'
			json={amino}
		/>
	</div>

	<ActionsLine back confirm={['Approve', F_NOOP, true]} />
</Screen>
