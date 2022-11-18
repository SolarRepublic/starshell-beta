<script lang="ts">
	import type {Coin} from '@cosmjs/amino';
	
	import type {Bech32, CoinInfo} from '#/meta/chain';

	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	import BigNumber from 'bignumber.js';
	
	import {Screen, Header} from './_screens';
	import {yw_account, yw_account_ref, yw_chain, yw_chain_ref, yw_network, yw_owner} from '../mem';
	import {load_page_context} from '../svelte';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {G_APP_STARSHELL} from '#/store/apps';
	import {Contracts} from '#/store/contracts';
	import {Entities} from '#/store/entities';
	import {fold} from '#/util/belt';
	
	import RequestSignature from './RequestSignature.svelte';
	import type {AssetType} from '../frag/AmountInput.svelte';
	import AmountInput from '../frag/AmountInput.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import Field from '../ui/Field.svelte';
	

	const {k_page} = load_page_context();

	export let si_coin: string;

	const s_chain = $yw_chain?.name || '?';


	// bindings for AmountInput
	let s_amount: string;
	let n_decimals: number;
	let s_symbol: string;
	let xc_asset: AssetType;
	let b_use_max: boolean;
	let g_coin: CoinInfo;

	let s_err_amount = '';

	$: if(b_use_max) {
		s_err_amount = 'No gas left for future transactions';
	}

	$: sa_token = g_coin?.extra?.native_bech32;

	$: b_form_valid = s_amount && g_coin && sa_token && !s_err_amount;

	// fee buffers
	$: h_fee_buffers = fold($yw_chain.feeCoinIds || [], si_coin => ({
		// TODO: use simulation data
		[si_coin]: BigNumber(15_000n+''),
	}));

	async function submit() {
		const [g_contract] = await Contracts.filterTokens({
			chain: $yw_chain_ref,
			bech32: sa_token,
		});

		k_page.push({
			creator: RequestSignature,
			props: {
				protoMsgs: Snip2xMessageConstructor.deposit($yw_account, {
					bech32: sa_token,
					chain: $yw_chain_ref,
					hash: g_contract?.hash || '',
				}, $yw_network as SecretNetwork, [
					{
						amount: BigNumber(s_amount).shiftedBy(n_decimals).toString(),
						denom: g_coin.denom,
					},
				]),
			},
			context: {
				chain: $yw_chain,
				accountPath: $yw_account_ref,
				app: G_APP_STARSHELL,
			},
		});
	}
</script>

<style lang="less">
	
</style>

<Screen form slides on:submit={(d_submit) => {
	d_submit.preventDefault();
}}>
	<Header pops
		title={'Wrapping'}
		postTitle={si_coin}
		subtitle={s_chain}
	/>

	<p>
		{si_coin} is the native gas coin for {s_chain}, its balances and transfer histories are not private.
	</p>
	
	<p>
		In order to take advantage of Secret's privacy features, you can wrap {si_coin} by converting it 1:1 to the s{si_coin} token.
	</p>

	<hr>

	<Field short key='amount' name='Amount'>
		<AmountInput
			feeBuffers={h_fee_buffers}
			assetPath={Entities.holdingPathFor($yw_owner, si_coin, $yw_chain_ref)}
			bind:assetType={xc_asset}
			bind:symbol={s_symbol}
			bind:useMax={b_use_max}
			bind:error={s_err_amount}
			bind:value={s_amount}
			bind:decimals={n_decimals}
			bind:coin={g_coin}
		/>
	</Field>

	<ActionsLine cancel confirm={['Next', () => submit(), !b_form_valid]}	/>
</Screen>
