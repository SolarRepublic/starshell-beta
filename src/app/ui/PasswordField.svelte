<script lang="ts">
	import {F_NOOP} from '#/util/belt';
	
	import {phrase_to_hyphenated} from '#/util/format';
	
	import Copyable from './Copyable.svelte';
	import Field from './Field.svelte';
	
	import SX_ICON_COPY from '#/icon/copy.svg?raw';
	import SX_ICON_EYE from '#/icon/visibility.svg?raw';

	export let password: string;

	export let label: string | undefined = '';
	const s_label = label || 'Password';

	let b_password_revealed = false;

</script>

<Field key={phrase_to_hyphenated(s_label)} name={s_label}>
	<svelte:fragment slot="right">
		<slot name="right" />
	</svelte:fragment>

	<Copyable let:copy>
		<style lang="less">
			@import './_base.less';

			.password {
				display: flex;
				gap: 8px;
				align-items: center;
				min-height: 3em;

				>* {
					flex: auto;

					&.payload {
						.hide-scrollbar();
						overflow-x: scroll;
						user-select: all;

						.fill-available();
						padding: 0.5em 0.75em;
						border: 1px solid var(--theme-color-border);
						border-radius: 8px;

						white-space: pre;
					}
				}
			}
		</style>

		<div class="password">
			<span class="payload">
				{#if b_password_revealed && 'string' === typeof password}
					{password}
				{:else}
					{'•'.repeat(44)}
				{/if}
			</span>
			<span class="global_svg-icon icon-diameter_20px reveal"
				style="color:var(--theme-color-text-med);"
				on:click={() => b_password_revealed = !b_password_revealed}
				on:keydown={F_NOOP}
			>
				{@html SX_ICON_EYE}
			</span>
			<span class="global_svg-icon icon-diameter_20px copy"
				style="color:var(--theme-color-primary);"
				on:click={() => copy(password)}
				on:keydown={F_NOOP}
			>
				{@html SX_ICON_COPY}
			</span>
		</div>
	</Copyable>
</Field>