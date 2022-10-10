<script lang="ts">
	import { F_NOOP } from '#/util/belt';

	import {
		yw_menu_expanded,
		yw_menu_vendor,
		yw_chain_ref,
		yw_chain,
		yw_provider_ref,
		yw_provider,
	} from '##/mem';

	import { global_receive } from '#/script/msg-global';
	import { onDestroy } from 'svelte';
import { SI_VERSION } from '#/share/constants';

	// import {
	// 	Icon,
	// } from '#/objects';

	// import {
	// 	Put,
	//  } from '#/ui';

	// import SX_CONTACTS from '@material-design-icons/svg/outlined/supervisor_account.svg?raw';
	// import SX_CHAINS from '@material-design-icons/svg/outlined/mediation.svg?raw';
	// import SX_ACCOUNTS from '@material-design-icons/svg/outlined/account_circle.svg?raw';
	// import SX_TAGS from '@material-design-icons/svg/outlined/bookmarks.svg?raw';
	// import SX_CONNECTIONS from '@material-design-icons/svg/outlined/account_tree.svg?raw';
	// import SX_SETTINGS from '@material-design-icons/svg/outlined/settings.svg?raw';
	// import SX_LOGOUT from '@material-design-icons/svg/outlined/sensor_door.svg?raw';
	// import SX_CLOSE from '@material-design-icons/svg/outlined/close.svg?raw';

	// import SX_TITLE from '#/asset/vendor/starshell-title.svg?raw';

	// $yw_menu_expanded

	interface Item {
		click: VoidFunction;
		label: string;
		// icon: Icon;
	}

	// let s_latency = '120ms';

	let s_height = '';
	let n_txs = 0;
	let xt_when = 0;
	let xt_avg_block_time = 0;

	let s_network_status = 'Loading';
	let p_provider = '';
	let si_chain = '';

	let s_grpcw_status = '';
	let s_rpc_status = '';


	// when the provider is changed
	$: if($yw_provider) {
		s_height = '[...]';
		xt_when = 0;
		xt_avg_block_time = 0;
		s_network_status = 'Connecting';
		p_provider = new URL($yw_provider.grpcWebUrl).host;
		si_chain = '';
		n_txs = 0;
	}

	global_receive({
		blockInfo(g_info) {
			if($yw_chain_ref === g_info.chain) {
				s_network_status = 'Online';
				si_chain = g_info.header.chain_id as string;

				s_height = g_info.header.height as string;
				xt_when = Date.now();

				n_txs = g_info.txCount;

				const a_recents = g_info.recents;
				if(a_recents.length > 1) {
					const a_gaps: number[] = [];
					for(let i_each=1; i_each<a_recents.length; i_each++) {
						a_gaps.push(a_recents[i_each] - a_recents[i_each-1]);
					}

					xt_avg_block_time = a_gaps.reduce((c_out, x_value) => c_out + x_value, 0) / a_gaps.length;
				}
			}
		},
	});

	let s_long_ago = '[...]';
	const i_long_ago = window.setInterval(() => {
		if(xt_when > 0) {
			const xt_ago = Date.now() - xt_when;
			s_long_ago = `${Math.round(xt_ago / 1e3)} seconds ago`;
		}
	}, 500);
	
	onDestroy(() => {
		clearInterval(i_long_ago);
	});

</script>

<style lang="less">
	@import '../../../style/util.less';

	:root {
		--bar-width: 78.8%;
		--animation-duration: 1s;
		--animation-easing: var(--ease-out-quick);
	}

	@keyframes fade {
		0% {
			background-color: transparent;
		}

		100% {
			background-color: rgba(0, 0, 0, 0.8);
		}
	}

	// @keyframes slide {
	// 	0% {
	// 		left: calc(0% - var(--bar-width));
	// 	}

	// 	100% {
	// 		left: 0%;
	// 	}
	// }	

	@keyframes opacity {
		0% {
			opacity: 0;
		}

		100% {
			opacity: 1;
		}
	}


	@keyframes offscreen {
		0% {
			top: 0;
		}

		100% {
			top: var(--app-window-height);
		}
	}

	.vendor-menu {
		--item-padding: 30px;

		.absolute();
		.font(regular);
		z-index: 1001;
		user-select: none;
		// color: var(--theme-color-black);

		>.backdrop {
			.absolute(100%);
			background-color: rgba(0, 0, 0, 0.8);
			transition: background-color var(--animation-duration) var(--ease-out-expo);
		}

		>.bar {
			position: absolute;
			top: 0;
			width: var(--bar-width);
			max-width: 400px;
			height: 100%;
			background-color: var(--theme-color-bg);
			left: 0%;
			opacity: 1;
			transition: left var(--animation-duration) var(--animation-easing),
				opacity calc(var(--animation-duration) / 3) ease-out;

			>.menu {
				display: flex;
				flex-direction: column;
				justify-content: space-evenly;
				height: 100%;

				ul {
					margin: 0;
					padding: 0;

					>li {
						list-style: none;
						padding: 13px 0;
						padding-left: var(--item-padding);
						cursor: pointer;

						>* {
							vertical-align: middle;
						}

						>.icon {
							--icon-diameter: 24px;
							padding: 0;
							padding-right: calc(var(--item-padding) / 2);
						}
					}

					&.items {
						.icon {
							--icon-color: var(--theme-color-black);
						}
					}

					&.session {
						padding: calc(var(--item-padding) / 2) 0;

						.icon {
							--icon-color: var(--theme-color-text-med);
						}
					}
				}

				>.main {
					flex: 1;
					display: flex;
					flex-direction: column;
					justify-content: flex-start;
					// padding-top: 15%;

					padding-left: 1em;

					>* {
						border-bottom: 1px solid var(--theme-color-border);
					}

					>.app {
						// margin-top: 25%;
						margin-top: 10px;
						color: var(--theme-color-text-med);
						.font(tiny);
						padding: 16px 0;
					}

					>.info {
						padding: 16px 0;

						.name {
							color: var(--theme-color-text-med);
							.font(tiny);
						}

						.value {
							padding-top: 4px;
						}
					}
				}

				>.bottom {
					flex: 0;
				}
			}
		}

		&.collapsed {
			pointer-events: none;
			top: 0;
			animation: offscreen var(--animation-duration) steps(2, jump-none) both;
			
			>.backdrop {
				background-color: rgba(0, 0, 0, 0);
			}

			>.bar {
				left: calc(0% - var(--bar-width));
				opacity: 0.1;
			}
		}


		hr {
			margin: 0 var(--item-padding);
			border: none;
			border-top: 1px solid var(--theme-color-border);
		}

		// .close-dark {
		// 	position: absolute;
		// 	top: 0;
		// 	right: 0;
		// 	margin: 10px;
		// 	padding: 12px;
		// 	cursor: pointer;
		// 	--icon-diameter: 24px;
		// 	--icon-color: var(--theme-color-black);

		// 	outline: 1px solid var(--theme-color-border);
		// 	border-radius: 0px;
		// 	transition: border-radius 650ms var(--ease-out-expo);
		// 	pointer-events: all;

		// 	&::before {
		// 		--occlusion-thickness: 4px;

		// 		content: '';
		// 		position: absolute;
		// 		top: calc(var(--occlusion-thickness) / 2);
		// 		left: calc(var(--occlusion-thickness) / 2);
		// 		width: calc(100% - var(--occlusion-thickness));
		// 		height: calc(100% - var(--occlusion-thickness));
		// 		outline: var(--occlusion-thickness) solid var(--theme-color-primary);
		// 		box-sizing: border-box;
		// 		pointer-events: none;
		// 	}

		// 	&:hover {
		// 		border-radius: 22px;
		// 	}
		// }

		.close {
			position: absolute;
			top: 0;
			right: 0;
			margin: 10px;
			padding: 12px;
			cursor: pointer;
			--icon-diameter: 24px;
			--icon-color: var(--theme-color-primary);

			outline: 1px solid var(--theme-color-border);
			border-radius: 0px;
			transition: border-radius 650ms var(--ease-out-expo);
			pointer-events: all;

			&::before {
				--occlusion-thickness: 4px;

				content: '';
				position: absolute;
				top: calc(var(--occlusion-thickness) / 2);
				left: calc(var(--occlusion-thickness) / 2);
				width: calc(100% - var(--occlusion-thickness));
				height: calc(100% - var(--occlusion-thickness));
				outline: var(--occlusion-thickness) solid var(--theme-color-bg);
				box-sizing: border-box;
				pointer-events: none;
			}

			&:hover {
				border-radius: 22px;
			}
		}
		
	}
</style>

<div
	class="vendor-menu"
	class:collapsed={!$yw_menu_vendor}
>
	<div class="backdrop"
		on:click={() => $yw_menu_vendor = false}
	/>

	<div class="bar">
		<div class="close icon" on:click={() => $yw_menu_vendor = false}>
			<!-- <img alt="Close icon" src="/assets/media/nav/close.svg"> -->
		</div>

		<div class="menu">
			<div class="main">
				<div class="app">
					<div>
						<!-- {@html SX_TITLE} -->
					</div>

					<div>
						v{SI_VERSION}
					</div>
				</div>

				<!-- <div>
					Current dApp
				</div> -->

				<!-- <div>
					domain: secretswap.io
				</div> -->

				<div class="info">
					<div class="name">
						Network Status
					</div>

					<div class="value">
						{s_network_status}
					</div>
				</div>

				<div class="info">
					<div class="name">
						Chain Id
					</div>

					<div class="value">
						<span class="font-family_mono">
							{si_chain}
						</span>
					</div>
				</div>

				<div class="info">
					<div class="name">
						Current Provider
					</div>

					<div class="value">
						<span class="font-family_mono">
							{p_provider}
						</span>
					</div>
				</div>

				<div class="info">
					<div class="name">
						Current Block Height
					</div>

					<div class="value">
						#{s_height}
					</div>
				</div>

				<div class="info">
					<div class="name">
						Average Block Time
					</div>

					<div class="value">
						{#if xt_avg_block_time}
							{(xt_avg_block_time / 1e3).toFixed(2)} seconds
						{:else}
							[...]
						{/if}
					</div>
				</div>

				<div class="info">
					<div class="name">
						Last Block Seen
					</div>

					<div class="value">
						{s_long_ago}
					</div>
				</div>

				<div class="info">
					<div class="name">
						Block Saturation
					</div>

					<div class="value">
						{n_txs} txs
					</div>
				</div>

				<!-- <div class="info">
					<div class="name">
						Next block in
					</div>

					<div class="value">
						 seconds
					</div>
				</div> -->

			</div>
		</div>
	</div>
</div>
