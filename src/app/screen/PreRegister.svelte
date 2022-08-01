<script lang="ts">
	import { Screen } from './_screens';

	import ActionsLine from '../ui/ActionsLine.svelte';
	import Register from './Register.svelte';
	import StarShellLogo from '../ui/StarShellLogo.svelte';
	import StarShellTitle from '../ui/StarShellTitle.svelte';
	import Horizon from '../ui/Horizon.svelte';
</script>

<style lang="less">
	@import '../../style/util.less';

	:global(.preregister) {
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: 20px;
		padding-left: 16px;
		padding-right: 16px;
		background-image: url('/media/vendor/orb-1.svg');
		background-repeat: no-repeat;
		background-position: center top;
		background-size: cover;

		padding-top: calc(50vh - 150px);
	}
</style>

<Screen root classNames='preregister'>
	<StarShellLogo dim={96} />

	<StarShellTitle />

	<Horizon />

	<div class="large">
		<div>Welcome to the beta program.</div>
		<div>Thank for you being a tester!</div>
	</div>

	<p>
		
	</p>

	<ActionsLine confirm={['Get Started']} contd={{creator:Register}} />
</Screen>
