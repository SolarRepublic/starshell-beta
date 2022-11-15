<script lang="ts">
	import type {Promisable} from '#/meta/belt';
	import type {ChainStruct, ChainPath, ContractStruct} from '#/meta/chain';

	import {Chains} from '#/store/chains';
	import {forever} from '#/util/belt';
    import { slide } from 'svelte/transition';

	import Field from '../ui/Field.svelte';
    import Load from '../ui/Load.svelte';
	import LoadingRows from '../ui/LoadingRows.svelte';
	import Row from '../ui/Row.svelte';
	import PfpDisplay from './PfpDisplay.svelte';


	export let contract: ContractStruct;

	export let concise = false;

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
			flex: 1;
		}

		.text {
			margin-left: 4px;
			vertical-align: middle;
		}
	}
</style>

{#if concise}
	<div class="chain-token" on:click={() => concise = !concise}>
		<span>
			{#if g_chain}
				<PfpDisplay dim={18}
					resource={g_chain}
					name={g_chain.reference}
				/>
				<span class="text">
					{g_chain.name}
				</span>
			{:else}
				<Load />
			{/if}
		</span>
		<span>
			{#await s_token_name}
				<Load />
			{:then s_token}
				<PfpDisplay dim={18}
					resource={contract}
					name={s_token}
				/>
				<span class="text">
					{s_token}
				</span>
			{/await}
		</span>
	</div>
{:else}
	<div class="chain-token" on:click={() => concise = !concise}>
		<Field key="chain" name="Chain" rootStyle="flex:auto;">
			{#if g_chain}
				<Row embedded
					resource={g_chain}
					name={g_chain.reference}
					detail={g_chain.name}
				/>
			{:else}
				<LoadingRows />
			{/if}
		</Field>

		<Field key="token" name="Token" rootStyle="flex:auto;">
			<Row embedded
				resource={contract}
				name={s_token_name}
				detail={s_token_detail}
			/>
		</Field>
	</div>
{/if}
