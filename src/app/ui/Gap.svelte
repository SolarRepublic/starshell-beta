<script lang="ts">
	let plain = false;
</script>

<style lang="less">
	.gap {
		height: 8px;
		background-color: black;

		.notPlain {
			margin-bottom: calc(0px - var(--ui-padding));
		}
	}
</style>

<div class="gap no-margin" class:notPlain={!plain}>&nbsp;</div>
