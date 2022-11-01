<script lang="ts">
	import type {EntityPath, CoinInfo, ContractPath, HoldingPath} from '#/meta/chain';
	
	import {Snip2xToken} from '#/schema/snip-2x-const';
	
	import BigNumber from 'bignumber.js';
	
	import {yw_account, yw_chain, yw_chain_ref, yw_network, yw_owner} from '../mem';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {XT_MINUTES} from '#/share/constants';
	import {Contracts} from '#/store/contracts';
	import {Entities} from '#/store/entities';
	
	import {QueryCache} from '#/store/query-cache';
	import {CoinGecko} from '#/store/web-apis';
	import {format_amount} from '#/util/format';
	
	import SX_ICON_INCREMENT from '#/icon/expand_less.svg?raw';
	import SX_ICON_DECREMENT from '#/icon/expand_more.svg?raw';

	export let value = '';

	export let disabled = false;

	const YG_ZERO = new BigNumber(0);
	const YG_ONE = new BigNumber(1);

	export let assetPath: HoldingPath | ContractPath | '' = '';

	/**
	 * Leave a buffer for the maximum amount that can be used
	 */
	export let bufferMax: BigNumber | number = 0;

	let g_asset: CoinInfo | null;

	let yg_max: BigNumber = YG_ZERO;
	let yg_step: BigNumber = YG_ZERO;
	let s_fiat_equivalent = '';

	$: {
		if(assetPath) {
			void reload_asset();
		}
		else {
			g_asset = null;
		}
	}

	let si_coingecko = '';
	$: {
		if(si_coingecko) {
			(async() => {
				const h_versus = await CoinGecko.coinsVersus([si_coingecko], 'usd', 1*XT_MINUTES);
				if(si_coingecko in h_versus) {
					s_fiat_equivalent = format_amount(+value * +h_versus[si_coingecko], true);
				}
				else {
					s_fiat_equivalent = '(?)';
				}
			})();
		}
		else {
			s_fiat_equivalent = '';
		}
	}

	async function reload_asset() {
		s_fiat_equivalent = '[...]';

		const g_entity = Entities.parseEntityPath(assetPath as EntityPath);
		if('holding' === g_entity?.type) {
			const si_coin = g_entity.coin;

			g_asset = $yw_chain.coins[si_coin];

			const g_cached = $yw_network.cachedCoinBalance($yw_owner, si_coin);

			if(g_cached && g_cached.timestamp > Date.now() - (5 * XT_MINUTES)) {
				yg_max = new BigNumber(g_cached.data.amount).shiftedBy(-g_asset.decimals).minus(new BigNumber(bufferMax));
			}

			const g_bundle = await $yw_network.bankBalance($yw_owner, si_coin);

			// still on same coin
			if(assetPath === g_bundle.holding) {
				const yg_amount = new BigNumber(g_bundle.balance.amount).shiftedBy(-g_asset.decimals).minus(new BigNumber(bufferMax));
				if(!yg_amount.eq(yg_max)) {
					yg_max = yg_amount;
				}

				const g_coin = $yw_chain.coins[si_coin];

				si_coingecko = g_coin?.extra?.coingecko_id || '';
			}
		}
		else if('contract' === g_entity?.type) {
			const g_contract = await Contracts.at(assetPath as ContractPath);

			if(g_contract && $yw_chain.features.secretwasm) {
				const ks_cache = await QueryCache.read();

				// start with the cached balance if it exists
				const g_cached = ks_cache.get($yw_chain_ref, $yw_owner, g_contract.bech32);
				if(g_cached && g_cached.timestamp > Date.now() - (5 * XT_MINUTES)) {
					yg_max = new BigNumber(g_cached.data.amount as string);
				}

				// get the latest balance
				const k_token = new Snip2xToken(g_contract, $yw_network as SecretNetwork, $yw_account);

				const g_balance = await k_token.balance();
				if(g_balance) {
					yg_max = new BigNumber(g_balance.balance.amount);
				}

				const g_snip20 = g_contract.interfaces.snip20!;

				si_coingecko = g_snip20.extra?.coingecko_id || '';

				g_asset = {
					decimals: g_snip20.decimals,
					denom: '',
					name: g_contract.name,
					extra: {
						coingecko_id: si_coingecko,
					},
					pfp: g_contract.pfp,
				};
			}
		}
		else if('token' === g_entity?.type) {
		// const h_interfaces = Entities.infoForToken();
			// ...
			// TODO: implement
			g_asset = null;
		}

		if(g_asset) {
			yg_step = YG_ONE.shiftedBy(-g_asset.decimals);
		}
		else {
			yg_step = YG_ZERO;
			yg_max = YG_ZERO;
		}
	}


	// $: xg_amount = BigInt((new BigNumber(value)).shiftedBy($yw_asset_send?.def.decimals || 0)+'');

	// $: yg_step = g_asset? YG_ONE.shiftedBy(-g_asset.decimals): YG_ZERO;
	// $: yg_max = Chains.
	// g_asset?.amount(H_TOKENS) || YG_ZERO;

	// // fix svelte's stupid mistake of coercing input[type="number"] values to es numbers
	// $: {
	// 	if('number' === typeof value) {
	// 		value = dm_input.value;
	// 	}
	// }

	function capture_input(d_event: Event) {
		value = (d_event.target as HTMLInputElement).value;
	}

	function increment() {
		const yg_next = yg_step.plus(value || 0);

		if(yg_next.lte(yg_max)) {
			value = yg_next+'';
		}
		else {
			value = yg_max+'';
		}

		check_validity();
	}

	function decrement() {
		const yg_next = yg_step.negated().plus(value || 0);
		if(yg_next.gte(0)) {
			if(yg_next.gt(yg_max)) {
				value = yg_max+'';
			}
			else {
				value = yg_next+'';
			}
		}
		else {
			value = '0';
		}

		check_validity();
	}

	function long_press(f_action: VoidFunction) {
		let i_ticker = 0;
		const i_buffer = window.setTimeout(() => {
			i_ticker = window.setInterval(f_action, 90);
		}, 1000);

		window.addEventListener('mouseup', () => {
			clearTimeout(i_buffer);
			clearInterval(i_ticker);
		}, {
			once: true,
		});
	}

	export let error = '';
	let dm_input: HTMLInputElement;

	function invalidate(s_msg: string) {
		dm_input.setCustomValidity(s_msg);
		error = s_msg;
	}

	function check_validity() {
		if(!value) {
			return invalidate('Enter an amount');
		}

		let yg_input!: BigNumber;
		try {
			yg_input = new BigNumber(value);
		}
		catch(e_parse) {
			return invalidate('Invalid number');
		}

		if(yg_input.lt(YG_ZERO)) {
			return invalidate('Value must be positive');
		}

		if(yg_input.gt(yg_max)) {
			return invalidate('Insufficient balance');
		}

		error = '';
	}

	export let showValidation = 0;
	$: {
		if(showValidation) {
			check_validity();
		}
		else if(!value) {
			error = '';
		}
	}
</script>

<style lang="less">
	@import './_base.less';

	input[type="number"] {
		appearance: textfield;

		&::-webkit-inner-spin-button, &::-webkit-outer-spin-button {
			-webkit-appearance: none;
		}
	}

	.amount-input {
		position: relative;
	}

	.occupy {
		position: absolute;
		right: 0;
		top: 0;
		height: var(--ui-row-height);

		display: flex;
		align-items: center;

		.adjust {

			display: flex;
			flex-direction: column;
			justify-content: center;
			gap: 4px;
			margin-right: 8px;

			.icon {
				cursor: pointer;
				padding: 0px 8px;
				--icon-diameter: 16px;
				--icon-color: var(--theme-color-primary);

				:global(svg) {
					width: var(--icon-diameter);
					height: var(--icon-diameter);
				}

				.increment {
					padding-top: 4px;
				}

				.decrement {
					padding-bottom: 4px;
				}
			}
		}

		.equivalent {
			.font(regular, @size: 13px, @weight: 300);

			.amount {
				color: var(--theme-color-text-med);
			}

			.fiat {
				color: var(--theme-color-text-med);
			}
		}
	}
</style>

<div class="amount-input">
	<input
		disabled={!assetPath || disabled}
		type="number"
		min="0"
		max={yg_max+'' || '0'}
		step="0.{'0'.repeat((g_asset?.decimals || 1) - 1)}1"
		required
		on:change={() => check_validity()}
		on:input={capture_input}
		{value}
		bind:this={dm_input}
		on:invalid={d => d.preventDefault()}
		class:invalid={error}
	>

	{#if g_asset}
		<span class="occupy">
			<span class="equivalent">
				<span class="amount">
					= {s_fiat_equivalent}
					<!--  amount_to_fiat(+value, $yw_asset_send, true) -->
				</span>
				<span class="fiat">
					USD
				</span>
			</span>

			<span class="adjust">
				<span class="icon increment clickable"
					on:click={() => increment()}
					on:mousedown={() => long_press(increment)}
				>
					{@html SX_ICON_INCREMENT}
				</span>

				<span class="icon decrement clickable"
					on:click={() => decrement()}
					on:mousedown={() => long_press(decrement)}
				>
					{@html SX_ICON_DECREMENT}
				</span>
			</span>
		</span>
	{/if}

	{#if error}
		<span class="validation-message">
			{error}
		</span>
	{/if}
</div>