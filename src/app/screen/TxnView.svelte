<script lang="ts">
	import { yw_account, yw_chain } from '##/mem';
	
	// import { Chain } from '#/objects/chain';
	// import type { Txn } from '#/objects/txn';
	// import type { Snip20 } from '#/type/snip20';
	// import Field from '#/ui/Field.svelte';
	
	// import Header from "#/ui/Header.svelte";
	// import Screen from "#/ui/Screen.svelte";
	// import Execute from './Execute.svelte';
	
	export let txn: Txn;
	const k_chain = H_CHAINS[txn.def.chainRef];
	const gd_chain = k_chain.def;
	export const chainId = gd_chain.id;
	export const familyId = H_FAMILIES[gd_chain.familyRef];

	let s_title = '';

	let g_bankish = txn.bankish($yw_account.address($yw_chain));

	let g_event: Txn.Event | null = txn.snip20();
	</script>
	
	<style lang="less">
		@import '_base.less';
	
		// div.icon {
		// 	margin: 0;
		// 	padding: 0 var(--ui-padding);
		// 	box-sizing: border-box;
	
		// 	img {
		// 		outline: 1px solid var(--theme-color-border);
		// 		border-radius: 0;
		// 	}
		// }
	
	
		// .screen.txn-view {
		// 	.field-name {
		// 		:global(&) {
		// 			flex: 1 !important;
		// 		}
		// 	}
	
		// 	.field-value {
		// 		:global(&) {
		// 			flex: 2 !important;
		// 		}
	
		// 		>.subtitle {
		// 			:global(&) {
		// 				color: var(--theme-color-text-med);
		// 				margin-left: 0.5em;
		// 			}
		// 		}
		// 	}
	
		// 	#field-contract {
		// 		.field-value {
		// 			:global(&) {
		// 				display: flex;
		// 				gap: 12px;
		// 			}
		// 		}
		// 	}
		// }
	</style>
	
	<!-- 
	<Screen nav slides classNames='txn-view'
	>
		<Header closes
			name={s_title}
			subname={txn.date()}
		/>
	
		
		<Field short
			key='sender'
			name='Status'
		>
			<span class="title">
				
			</span>
		</Field>
	
		<hr>
	
		<Field short
			key='fee'
			name='Fee'
		>
			<span class="title">
				0.03 SCRT
			</span>
	
			<span class="subtitle">
				={amount_to_fiat(0.03, $yw_chain.native(H_TOKENS))}
			</span>
		</Field>
	
		<Field short
			key='fee'
			name='Fee'
		>
			<span class="title">
				0.03 SCRT
			</span>
	
			<span class="subtitle">
				={amount_to_fiat(0.03, $yw_chain.native(H_TOKENS))}
			</span>
		</Field>
	
		<hr>
	</Screen> -->
	
	<Execute contract={txn.def.address} event={g_event} />
	