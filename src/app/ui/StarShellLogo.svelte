<script lang="ts">
	import { F_NOOP } from "#/util/belt";

	/**
	 * target dimensinos
	 */
	export let dim: 32 | 48 | 64 | 96 | 128;
	const x_dim = dim;

	/**
	 * alternative text
	 */
	export let alt = 'StarShell logo';
	const s_alt = alt;

	const f_src = (x: number) => `/media/vendor/logo-${x}px.png`;

	const sr_default = f_src(x_dim);
	const sr_double = f_src(x_dim * 2);
</script>

<style lang="less">
	.logo {
		display: block;
		margin: 0;
		padding: 0;
		border: 0;
		user-select: none;

		margin-left: auto;
		margin-right: auto;

		img {
			width: 100%;
			height: 100%;
		}
	}
</style>

<picture class="no-margin logo" style="width:{x_dim}px; height:{x_dim}px;" on:click>
	<source srcset="{sr_double}" media="(min-resolution: 2dppx)">
	<img alt={s_alt} src="{sr_default}" />
</picture>
