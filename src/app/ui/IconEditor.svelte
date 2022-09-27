<script lang="ts">
	import SX_ICON_IMAGE from '#/icon/image.svg?raw';
	import type { Pfp, PfpTarget } from '#/meta/pfp';
	import { Pfps } from '#/store/pfps';
	import { F_NOOP } from '#/util/belt';

	import PfpDisplay from './PfpDisplay.svelte';
	
	export let pfpRef: '' | PfpTarget;
	const p_pfp = pfpRef || '';

	export let name = '';
	const s_name = name;

	export let intent: 'token' | 'person' = 'token';
	const si_intent = intent;

	let g_pfp: Pfp['interface'];

	(async() => {
		if(p_pfp) {
			g_pfp = (await Pfps.at(p_pfp))!;
		}
	})();

	// const p_icon = iconRef || Icon.Def.BLANK.iri;

	// const k_icon = p_icon? H_ICONS[p_icon]: Icon.BLANK;
</script>
	
<style lang="less">
	@import './_base.less';

	.area {
		border: 1px dashed var(--theme-color-border);
		border-radius: 4px;

		>.row {
			display: flex;
			justify-content: space-between;
			margin: var(--ui-padding);

			>* {
				flex: auto;
			}

			>.left {
				flex: 1;

				>.icon.pfp {
					:global(&) {
						--button-diameter: 64px;
						--icon-diameter: 64px;
					}
				}
			}

			>.right {
				flex: 3;
				padding: 0 calc(var(--ui-padding) / 2);
				margin-top: -4px;
				// padding-top: calc(var(--ui-padding) / 1.5);

				>.disclaimer {
					.font(tiny);

					>.warning {
						color: var(--theme-color-caution);
					}

					>.info {

					}
				}
			}

			// padding-bottom: 20px;

			.actions {
				color: var(--theme-color-primary);
				margin-top: 4px;

				// white-space: nowrap;
				// position: absolute;
				// margin-top: 4px;
				// margin-left: -4px;

				>* {
					cursor: pointer;

					&:hover {
						>.text {
							text-decoration: underline;
						}
					}

					>* {
						vertical-align: middle;
					}

					>.icon {
						--icon-color: var(--theme-color-primary);
						--icon-diameter: 20px;
					}
				}
			}
		}
	}
</style>

<div class="area" class:intent-person={'person' === si_intent}>
	<div class="row">
		<span class="left">
			<!-- <span class="icon pfp" class:square={'person' === intent}>
				<Put element={H_ICONS[p_icon].render()} />
			</span> -->
			{#if p_pfp}
				<PfpDisplay dim={48} ref={p_pfp} name={s_name} />
			{/if}
			<!-- <PfpDisplay bind:iconRef={iconRef} bind:name={name} /> -->
		</span>

		<span class="right">
			<div class="disclaimer">
				<span class="warning">
					Notice:
				</span>
				<span class="info">
					Uploaded icons will be resized to be square. Only JPG & PNG files less than 1MB allowed.
				</span>
			</div>

			<div class="actions">
				<div class="upload" on:click={() => F_NOOP}>
					<span class="icon">
						{@html SX_ICON_IMAGE}
					</span>
					<span class="text">
						Upload Icon
					</span>
				</div>
			</div>
		</span>
	</div>
</div>
