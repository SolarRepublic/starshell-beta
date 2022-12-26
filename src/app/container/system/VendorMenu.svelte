<script lang="ts">
	import type {ChainPath, ChainStruct} from '#/meta/chain';
	
	import {onDestroy} from 'svelte';
	
	import {syserr} from '#/app/common';
	import {system_notify} from '#/extension/notifications';
	import {global_receive} from '#/script/msg-global';
	import {NetworkFeed} from '#/script/service-feed';
	import {SI_VERSION} from '#/share/constants';
	
	import {Chains} from '#/store/chains';
	import {Histories} from '#/store/incidents';
	import {ConnectionHealth, H_HEALTH_COLOR, Providers} from '#/store/providers';
	import {ode} from '#/util/belt';
	import {
		yw_menu_vendor,
		yw_chain_ref,
		yw_connection_health,
		yw_chain,
		yw_network,
	} from '##/mem';

	interface ConnectionState {
		xc_health: ConnectionHealth;
		s_network_status: string;
		s_height: string;
		n_txs: number;
		xt_when: number;
		xt_avg_block_time: number;
		p_provider: string;
		g_chain: ChainStruct;
	}

	// current chain namespace and reference ids
	$: si_namespace = $yw_chain?.namespace || '[...]';
	$: si_reference = $yw_chain?.reference || '[...]';

	// keep track of all chains
	const h_connections: Record<ChainPath, ConnectionState> = {};

	let g_connection_active: ConnectionState;
	yw_chain_ref.subscribe((p_chain) => {
		if(p_chain) {
			g_connection_active = h_connections[p_chain];
		}
	});

	let s_network_status = 'Loading';
	let s_height = '[...]';
	let n_txs = 0;
	let xt_avg_block_time = 0;
	let p_provider = '[...]';

	let s_err_fix = '';

	// initialize all states
	(async function load() {
		const ks_chains = await Chains.read();

		for(const [p_chain, g_chain] of ks_chains.entries()) {
			const g_connection = h_connections[p_chain] = {
				s_height: '[...]',
				n_txs: 0,
				xt_when: 0,
				xt_avg_block_time: 0,
				s_network_status: 'Loading',
				p_provider: '[...]',
				xc_health: ConnectionHealth.LOADING,
				g_chain,
			};

			// current chain; trigger property update
			if(p_chain === $yw_chain_ref) {
				update_connection(g_connection, {});
			}
		}
	})();

	$: sx_health_color = H_HEALTH_COLOR[$yw_connection_health];

	function update_connection(g_connection: ConnectionState, g_update: Partial<ConnectionState>) {
		const p_chain = Chains.pathFrom(g_connection.g_chain);

		Object.assign(g_connection, g_update);

		// this connection is the lead for the current chain
		if($yw_chain_ref === p_chain) {
			// trigger reactive update if its different
			if(g_connection_active !== g_connection) g_connection_active = g_connection;

			// set connection health in mem for interaction context
			$yw_connection_health = g_connection_active.xc_health;

			// update local ui properties
			({
				s_network_status,
				s_height,
				n_txs,
				xt_avg_block_time,
				p_provider,
			} = g_connection_active);
		}
	}

	let b_unresponsive = false;

	global_receive({
		unresponsiveService() {
			b_unresponsive = true;

			// consider all chains disconnected
			for(const [p_chain, g_connection] of ode(h_connections)) {
				update_connection(g_connection, {
					xc_health: ConnectionHealth.DISCONNECTED,
					s_network_status: 'Service unresponsive',
				});
			}

			// set fix
			s_err_fix = 'restart';
		},

		blockInfo(g_info) {
			const g_connection = h_connections[g_info.chain];

			if(g_connection) {
				console.debug(`Received blockInfo for ${Chains.caip2From(g_connection.g_chain)} #${g_info.header.height} from <${g_connection.p_provider}>`);

				// only interested in active chain
				const p_chain = Chains.pathFrom(g_connection.g_chain);
				if(p_chain !== $yw_chain_ref) return;

				// debugger;
				update_connection(g_connection, {
					xc_health: ConnectionHealth.CONNECTED,
					s_network_status: 'Online',
					s_height: g_info.header.height,
					xt_when: Date.now(),
					n_txs: g_info.txCount,
				});

				// overwrite supposed chain reference
				si_reference = g_info.header.chain_id;

				// chain id mismatch
				if(si_reference !== g_connection.g_chain.reference) {
					throw syserr({
						title: 'Misconfigured node provider',
						text: `Your wallet was configured to use ${g_connection.p_provider} for ${g_connection.g_chain.reference} but the remote node provider is currently operating on ${si_reference}.`,
					});
				}

				// load provider from store
				void Providers.at(g_info.provider).then((g_provider) => {
					if(g_provider) {
						update_connection(g_connection, {
							p_provider: new URL(g_provider.grpcWebUrl).host,
						});
					}
					else {
						update_connection(g_connection, {
							p_provider: '(unknown)',
						});
					}
				});

				const a_recents = g_info.recents;
				if(a_recents.length > 1) {
					const a_gaps: number[] = [];
					for(let i_each=1; i_each<a_recents.length; i_each++) {
						a_gaps.push(a_recents[i_each] - a_recents[i_each-1]);
					}

					// recompute average block time
					g_connection.xt_avg_block_time = a_gaps.reduce((c_out, x_value) => c_out + x_value, 0) / a_gaps.length;

					// wait for initialization
					if(g_connection.xt_when) {
						// cache this cache
						const s_last = s_height;

						// wait for the twice the length of the average block time
						setTimeout(() => {
							// no new blocks produced; consider deliquent
							if(s_height === s_last) {
								update_connection(g_connection, {
									xc_health: ConnectionHealth.DELINQUENT,
									s_network_status: 'Delinquent',
								});
							}
						}, g_connection.xt_avg_block_time * 2);
					}
				}
			}
		},
	});

	let s_long_ago = '[...]';
	const i_long_ago = window.setInterval(() => {
		if(g_connection_active?.xt_when > 0) {
			const xt_ago = Date.now() - g_connection_active.xt_when;
			s_long_ago = `${Math.round(xt_ago / 1e3)} seconds ago`;
		}
	}, 500);
	
	onDestroy(() => {
		clearInterval(i_long_ago);
	});

	let s_resync_status = '';
	async function force_resync() {
		s_resync_status = 'resyncing....';

		let k_feed: NetworkFeed;
		try {
			await Histories.resetSyncInfo($yw_chain_ref);

			// create network feed
			k_feed = await NetworkFeed.create($yw_chain, $yw_network.provider, {
				notify: system_notify,
			});
		}
		catch(e_resync) {
			s_resync_status = 'failed to resync';
			return;
		}

		// destroy it once sycs have completed
		k_feed.destroy();

		s_resync_status = 'done';

		setTimeout(() => {
			s_resync_status = '';
		}, 10e3);
	}

	function restart(d_event: MouseEvent) {
		chrome.runtime?.reload?.();
	}

	let b_shift_key = false;
	document.addEventListener('keydown', (d_event) => {
		b_shift_key = d_event.shiftKey;
	});

	document.addEventListener('keyup', () => {
		b_shift_key = false;
	});
</script>

<style lang="less">
	@import '../../_base.less';

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
							display: flex;
							justify-content: space-between;

							padding-top: 4px;
							padding-right: 6px;
							margin-right: 6px;
							overflow-x: scroll;
							.hide-scrollbar();

							.state {
								display: inline-block;
								width: 8px;
								height: 8px;
								border-radius: 4px;
								vertical-align: middle;
								margin-right: 2px;
								margin-top: -2px;
								border: 1px solid black;
							}
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

	.caip2-namespace {
		opacity: 0.5;
	}

	.action {
		.font(tiny);
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
		<div class="menu">
			<div class="main">
				<div class="app">
					<div>
						v{SI_VERSION}
					</div>
				</div>

				<div class="info">
					<div class="name">
						Network Status
					</div>

					<div class="value">
						<span>
							<span class="state" style={`
								background-color: ${sx_health_color};
							`}>
								&nbsp;
							</span>
							<span class="text">
								{s_network_status}
							</span>
						</span>

						{#if s_err_fix || b_shift_key}
							<span class="action link" on:click={restart}>
								{s_err_fix || 'restart'}
							</span>
						{/if}
					</div>
				</div>

				<div class="info">
					<div class="name">
						Chain
					</div>

					<div class="value">
						<span class="font-family_mono">
							<span class="caip2-namespace">{si_namespace}:</span><!--
							--><span class="caip2-reference">{si_reference}</span>
						</span>
					</div>
				</div>

				<div class="info">
					<div class="name">
						Current Provider
					</div>

					<div class="value">
						{#if p_provider}
							<span class="font-family_mono">
								{p_provider}
							</span>
						{:else}
							<span style="font-style:italic;">
								(none)
							</span>
						{/if}
					</div>
				</div>

				<div class="info">
					<div class="name">
						Current Block Height
					</div>

					<div class="value">
						<span>
							#{s_height}
						</span>
						{#if s_resync_status}
							<span class="action">
								{s_resync_status}
							</span>
						{:else if b_shift_key}
							<span class="action link" on:click={force_resync}>
								force resync
							</span>
						{/if}
					</div>
				</div>

				<div class="info">
					<div class="name">
						Average Block Time
					</div>

					<div class="value">
						{#if xt_avg_block_time}
							{(xt_avg_block_time / 1e3).toFixed(2)} seconds / block
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
			</div>
		</div>
	</div>
</div>
