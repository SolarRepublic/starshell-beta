<script lang="ts">
	import type {Promisable} from '#/meta/belt';
	import type {Bech32, ChainStruct} from '#/meta/chain';
	
	import {yw_chain, yw_network, yw_owner} from '../mem';
	
	import {Chains} from '#/store/chains';
	
	import Load from '../ui/Load.svelte';
	import ResourceControl from '../ui/ResourceControl.svelte';
	
	import SX_ICON_MONEY_SLOT from '#/icon/money-slot.svg?raw';
	
	

	export let si_coin: string;

	export let sa_owner: Bech32 = $yw_owner;

	export let a_delegations = [];

	const g_coin = $yw_chain.coins[si_coin];

	(async function load() {
		a_delegations = await $yw_network.delegations(sa_owner);

		console.log(a_delegations);

		await $yw_network.stakingInfo();
	})();

	function resource_click(d_event: MouseEvent) {

	}
</script>

<style lang="less">
	@import '../_base.less';

	.staking {
		>.content {
			>.title {
				.font(regular);
			}

			>.info {
				.font(tiny);
				color: var(--theme-color-text-med);
			}
		}

		button {
			max-width: fit-content;
		}
	}
</style>

<ResourceControl infoIcon={SX_ICON_MONEY_SLOT} s_icon_dim='24px' b_hr_less on:click={resource_click}>
	<div class="staking global_flex-auto">
		<span class="content">
			<span class="title">
				Staking
			</span>
		</span>

		<button class="pill">
			Stake {si_coin}
		</button>
	</div>
</ResourceControl>
