<script lang="ts">
	import { F_NOOP, timeout } from '#/util/belt';

	import {
		yw_menu_expanded, yw_navigator,
	} from '#/app/mem';

	import SX_ICON_CONTACTS from '#/icon/supervisor_account.svg?raw';
	import SX_ICON_CHAINS from '#/icon/mediation.svg?raw';
	import SX_ICON_ACCOUNTS from '#/icon/account_circle.svg?raw';
	import SX_ICON_TAGS from '#/icon/bookmarks.svg?raw';
	import SX_ICON_CONNECTIONS from '#/icon/account_tree.svg?raw';
	import SX_ICON_SETTINGS from '#/icon/settings.svg?raw';
	import SX_ICON_LOGOUT from '#/icon/sensor_door.svg?raw';
	import SX_ICON_CLOSE from '#/icon/close.svg?raw';
	import { ThreadId } from '#/app/def';
	import { getContext } from 'svelte';
	import type { Page } from '##/screen/_screens';
	import { logout } from '#/share/auth';

	interface Item {
		click: VoidFunction;
		label: string;
		// icon: Icon;
		icon: string;
	}

	const k_page = getContext<Page>('page');

	function activate(si_thread: ThreadId) {
		$yw_menu_expanded = false;

		if(si_thread === $yw_navigator.activeThread.id) {
			$yw_navigator.activeThread.reset();
		}
		else {
			void $yw_navigator.activateThread(si_thread);
		}
	}

	const A_ITEMS = [
		// {
		// 	label: 'Contacts',
		// 	// icon: Icon.fromHtml(SX_ICON_CONTACTS),
		// 	icon: SX_ICON_CONTACTS,
		// 	click() {
		// 		$yw_menu_expanded = false;
		// 		void $yw_navigator.activateThread(ThreadId.CONTACTS);
		// 	},
		// },
		{
			label: 'Accounts',
			// icon: Icon.fromHtml(SX_ICON_ACCOUNTS),
			icon: SX_ICON_ACCOUNTS,
			click() {
				activate(ThreadId.ACCOUNTS);
			},
		},
		{
			label: 'Networks',
			// icon: Icon.fromHtml(SX_ICON_CHAINS),
			icon: SX_ICON_CHAINS,
			click() {
				activate(ThreadId.NETWORKS);
			},
		},
		// {
		// 	label: 'Tags',
		// 	// icon: Icon.fromHtml(SX_ICON_TAGS),
		// 	icon: SX_ICON_TAGS,
		// 	click() {
		// 		$yw_menu_expanded = false;
		// 		// k_page.push({
		// 		// 	creator: DeadEnd,
		// 		// });
		// 	},
		// },
		// {
		// 	label: 'Sites',
		// 	// icon: Icon.fromHtml(SX_ICON_CONNECTIONS),
		// 	icon: SX_ICON_CONNECTIONS,
		// 	click() {
		// 		$yw_menu_expanded = false;
		// 		void $yw_navigator.activateThread(ThreadId.SITES);
		// 	},
		// },
		// {
		// 	label: 'Settings',
		// 	// icon: Icon.fromHtml(SX_ICON_SETTINGS),
		// 	icon: SX_ICON_SETTINGS,
		// 	click: () => {
		// 		$yw_menu_expanded = false;
		// 		k_page.push({
		// 			creator: DeadEnd,
		// 		});
		// 	},
		// },
	];

	const A_SESSION_ITEMS = [
		{
			label: 'Log out',
			icon: SX_ICON_LOGOUT,
			async click() {
				await logout();
				globalThis.close();
			},
		},
	];
</script>

<style lang="less">
	@import '../../screen/_base.less';

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

	@keyframes slide {
		0% {
			right: calc(0% - var(--bar-width));
		}

		100% {
			right: 0%;
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

	.side-menu {
		--item-padding: 30px;

		.absolute();
		.font(regular);
		z-index: 1001;
		user-select: none;

		>.backdrop {
			.absolute(100%);
			background-color: rgba(0, 0, 0, 0.8);
			transition: background-color var(--animation-duration) var(--ease-out-expo);
		}

		>.bar {
			position: absolute;
			top: 0;
			width: var(--bar-width);
			height: 100%;
			background-color: var(--theme-color-bg);
			right: 0%;
			transition: right var(--animation-duration) var(--animation-easing);

			>.menu {
				display: flex;
				flex-direction: column;
				justify-content: space-evenly;
				height: 100%;

				ul {
					margin: 0;
					padding: 0;
					display: flex;
					flex-direction: column-reverse;

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
							--icon-color: var(--theme-color-primary);
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
					justify-content: flex-end;
					padding-top: 15%;
					padding-bottom: 15%;
				}

				>.bottom,>.top {
					flex: 0;
				}

				>.top {
					padding-top: 15%;
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
				right: calc(0% - var(--bar-width));
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
</style>

<div
	class="side-menu"
	class:collapsed={!$yw_menu_expanded}
>
	<div class="backdrop"
		on:click={() => $yw_menu_expanded = false}
	/>

	<div class="bar">
		<div class="close icon" on:click={() => $yw_menu_expanded = false}>
			{@html SX_ICON_CLOSE}
		</div>

		<div class="menu">
			<div class="top">
				<ul class="session">
					{#each A_SESSION_ITEMS as g_item}
						<li on:click={() => g_item.click()}>
							<span class="icon">
								{@html g_item.icon}
								<!-- <Put element={g_item.icon.render()} /> -->
							</span>
							<span class="text">
								{g_item.label}
							</span>
						</li>
					{/each}
				</ul>

				<hr>
			</div>

			<div class="main">
				<ul class="items">
					{#each A_ITEMS as g_item}
						<li class="" on:click={() => g_item.click()}>
							<span class="icon">
								{@html g_item.icon}
								<!-- <Put element={g_item.icon.render()} /> -->
							</span>
							<span class="text">
								{g_item.label}
							</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>
</div>