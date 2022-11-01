<script lang="ts">
	import type {Promisable} from '#/meta/belt';
	import type {ChainStruct, ChainPath, ContractStruct} from '#/meta/chain';

	import {Chains} from '#/store/chains';
	import {forever} from '#/util/belt';

	import Field from './Field.svelte';
	import LoadingRows from './LoadingRows.svelte';
	import Row from './Row.svelte';


	export let contract: ContractStruct;

	let g_chain: ChainStruct;
	let p_chain: ChainPath;

	let s_token_name: Promisable<string> = forever('');
	const s_token_detail = contract.name;

	(async() => {
		g_chain = (await Chains.at(contract.chain))!;
		p_chain = Chains.pathFrom(g_chain);

		const g_snip20 = contract.interfaces.snip20;
		if(g_snip20) {
			s_token_name = g_snip20.symbol;
		}
	})();
</script>

<style lang="less">
	.chain-token {
		display: flex;

		>* {
			flex: auto;
		}
	}
</style>

<div class="chain-token">
	<Field key="chain" name="Chain" rootStyle="flex:auto;">
		{#if g_chain}
			<Row
				resource={g_chain}
				name={g_chain.reference}
				detail={g_chain.name}
				rootStyle="padding-left:0;"
			/>
		{:else}
			<LoadingRows />
		{/if}
	</Field>

	<Field key="token" name="Token" rootStyle="flex:auto;">
		<Row
			resource={contract}
			name={s_token_name}
			detail={s_token_detail}
			rootStyle="padding-left:0;"
		/>
	</Field>
</div>