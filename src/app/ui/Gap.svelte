<script lang="ts">
	let plain = false;

	export let rootStyle = '';
</script>

<style lang="less">
	.gap {
		height: 4px;
		background-color: black;

		.notPlain {
			margin-bottom: calc(0px - var(--ui-padding));
		}
	}
</style>

<div class="gap no-margin no-flex"
	class:notPlain={!plain}
	style={rootStyle}
>&nbsp;</div>
