<script lang="ts">
	import { Screen } from './_screens';

	import ActionsLine from '../ui/ActionsLine.svelte';
	import StarShellLogo from '../ui/StarShellLogo.svelte';
	import StarShellTitle from '../ui/StarShellTitle.svelte';
	import Horizon from '../ui/Horizon.svelte';
	import { open_external_link } from '#/util/dom';
</script>

<style lang="less">
	@import '../../style/util.less';

	:global(.restricted) {
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 20px;
		padding-left: 16px;
		padding-right: 16px;
		background-repeat: no-repeat;
		background-position: center top;
		background-size: cover;

		padding-top: calc(50vh - 150px);
	}
</style>

<Screen root classNames='restricted'>
	<StarShellLogo dim={96} />

	<StarShellTitle />

	<Horizon />

	<div class="large">
		<div>Please update to continue beta testing.</div>
		<div>A new version has been released.</div>
	</div>

	<p>
		
	</p>

	<ActionsLine confirm={['See Instructions', () => open_external_link('https://github.com/SolarRepublic/starshell-beta/README.md')]} />
</Screen>
