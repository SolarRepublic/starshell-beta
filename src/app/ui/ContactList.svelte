<script lang="ts">
	import {quintOut} from 'svelte/easing';
	import {yw_chain, yw_chain_namespace} from '##/mem';

	import SX_ICON_DOTS from '#/icon/more-vert.svg?raw';
	import SX_ICON_EDIT from '#/icon/edit.svg?raw';
	import SX_ICON_SEND from '#/icon/upload.svg?raw';
	import SX_ICON_DELETE from '#/icon/delete.svg?raw';

	import SX_ICON_PERSONAL from '#/icon/account_box.svg?raw';
	import SX_ICON_CONTRACT from '#/icon/analytics.svg?raw';

	import {slide} from 'svelte/transition';
	import Address from './Address.svelte';
	import Row from './Row.svelte';
	import type {Dict, JsonPrimitive} from '#/meta/belt';

	import InlineTags from './InlineTags.svelte';

	import ContactEdit from '##/screen/ContactEdit.svelte';
	import Send from '##/screen/Send.svelte';
	import DeadEnd from '##/screen/DeadEnd.svelte';
	import ContactView from '##/screen/ContactView.svelte';

	import type {Contact, ContactInterface, ContactPath} from '#/meta/contact';
	import {Agents} from '#/store/agents';
	import {Chains} from '#/store/chains';

	import type {Page} from '../screen/_screens';
	import {getContext} from 'svelte';

	// get page from context
	const k_page = getContext<Page>('page');


	export let filter: (g_contact: ContactInterface) => boolean = g => true;

	export let sort: (g_a: ContactInterface, g_b: ContactInterface) => number = (g_a, g_b) => g_a.name < g_b.name? -1: 1;

	export let append: ContactInterface[] = [];


	// load all contacts for the current chain's family as a list
	async function load_contacts(): Promise<[ContactPath, ContactInterface][]> {
		// read from agents store
		const ks_agents = await Agents.read();

		// spread iterator into array
		return [...ks_agents.contacts($yw_chain_namespace)];
	}

	const hm_events = new WeakMap<Event, Dict<JsonPrimitive>>();

	let si_overlay = '';
	function activate_overlay(p_contact: string, g_contact: ContactInterface): (d: MouseEvent) => void {
		return (d_event: MouseEvent) => {
			// prevent event from bubbling
			d_event.stopImmediatePropagation();

			// ref entry id
			const si_set = p_contact;

			// overlay already set to this entry; hide it
			if(hm_events.get(d_event)?.cancelMenu === si_set) {
				si_overlay = '';
				return;
			}

			// set overlay to this entry
			si_overlay = si_set;

			// remove on click event
			window.addEventListener('click', () => {
				hm_events.set(d_event, {
					cancelMenu: si_overlay,
				});
				si_overlay = '';
			}, {
				capture: true,
				once: true,
			});
		};
	}

	const a_overlay_actions: {
		label: string;
		icon: string;
		click(g_contact: ContactInterface): void;
	}[] = [
		{
			label: 'Edit',
			icon: SX_ICON_EDIT,
			click(g_contact: ContactInterface) {
				k_page.push({
					creator: ContactEdit,
					props: {
						contact: g_contact,
					},
				});
			},
		},
		{
			label: 'Send',
			icon: SX_ICON_SEND,
			click(g_contact: ContactInterface) {
				k_page.push({
					creator: Send,
					props: {
						recipient: Chains.transformBech32(g_contact.address, $yw_chain),
					},
				});
			},
		},
		{
			label: 'Delete',
			icon: SX_ICON_DELETE,
			click(g_contact: ContactInterface) {
				// TODO:
				k_page.push({
					creator: DeadEnd,
					props: {},
				});
			},
		},
	];
</script>

<style lang="less">
	@import './_base.less';

	.rows {
		margin-left: calc(0px - var(--ui-padding));
		margin-right: calc(0px - var(--ui-padding));

		.row {
			.status {
				:global(&) {
					position: relative;
				}

				.icon.more-menu {
					:global(&) {
						padding-top: 50%;
						padding-bottom: 50%;
						--icon-diameter: 24px;
						--icon-color: var(--theme-color-primary);
						outline: 1px solid transparent;
						transition: 350ms outline-color var(--ease-out-cubic);
					}

					:global(&:hover) {
						outline-color: var(--theme-color-border);
					}

					:global(&:active), :global(&.active) {
						outline-color: var(--theme-color-primary);
					}
				}

				.overlay {
					:global(&) {
						position: absolute;
						padding: 10px 14px;
						background-color: rgba(0, 0, 0, 0.8);
						border-radius: 8px;
						right: 26px;
						top: -18px;
						min-width: 120px;
						z-index: 100;
					}

					>.action {
						:global(&) {
							display: flex;
							padding: 10px 8px;
						}

						>.text {
							:global(&) {
								padding-left: 10px;
							}
						}
					}

					.icon {
						:global(&) {
							--icon-diameter: 24px;
							--icon-color: var(--theme-color-primary);
						}
					}
				}
			}
		}
	}

	.icon.contact-type {
		--icon-diameter: 16px;
		--icon-color: var(--theme-color-text-med);
	}

	.pfp-gen {
		.font(huge);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: 20%;
		outline: 1px solid var(--theme-color-primary);
		background: radial-gradient(ellipse farthest-side at bottom right, #07080a, #0f1317);
	}
</style>

<div class="rows">
	{#await load_contacts()}
		Loading contacts...
	{:then a_list}
		{#each a_list as [p_contact, g_contact]}
			<Row
				resource={g_contact}
				resourcePath={p_contact}
				on:click={(d_event) => {
					if(!hm_events.get(d_event)?.cancelMenu) {
						k_page.push({
							creator: ContactView,
							props: {
								contact: g_contact,
							},
						});
					}
				}}
			>
				<svelte:fragment slot="detail">
					<Address address={Agents.addressFor(g_contact, $yw_chain)} />
				</svelte:fragment>

				<svelte:fragment slot="tags">
					<InlineTags collapsed rootStyle='margin: 0px;'
						resourcePath={p_contact}
					>
						<span class="icon contact-type" slot="prefix">
							{@html SX_ICON_PERSONAL}
						</span>
					</InlineTags>
				</svelte:fragment>

				<svelte:fragment slot="status">
					<span
						class="icon more-menu"
						class:active={si_overlay === p_contact}
						on:click={activate_overlay(p_contact, g_contact)}
					>
						{@html SX_ICON_DOTS}
					</span>

					{#if si_overlay === p_contact}
						<span class="overlay" transition:slide={{duration:300, easing:quintOut}}>
							{#each a_overlay_actions as g_action}
								<div class="action" on:click={(d_event) => {
									d_event.stopPropagation();
									g_action.click(g_contact);
								}}>
									<span class="icon">
										{@html g_action.icon}
									</span>

									<span class="text">
										{g_action.label}
									</span>
								</div>
							{/each}
						</span>
					{/if}
				</svelte:fragment>
			</Row>
		{/each}
	{/await}
</div>