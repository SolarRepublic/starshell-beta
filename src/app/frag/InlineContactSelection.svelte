<script context="module" lang="ts">
	export interface ContactOption {
		value: Chain.Bech32String;
		label: string;
		contact: ContactStruct;
	}
</script>

<script lang="ts">
	import type {Chain} from '#/meta/chain';
	import type {ContactStruct} from '#/meta/contact';
	
	import {onDestroy} from 'svelte';
	
	import {subscribe_store} from '#/store/_base';
	import {Agents} from '#/store/agents';
	
	
	import {yw_chain, yw_chain_namespace} from '##/mem';

	import Address from './Address.svelte';
	import PfpDisplay from './PfpDisplay.svelte';

	/**
	 * Resource path to the contact
	 */
	export let contact: ContactStruct | null = null;
	let g_contact: ContactStruct = contact!;

	/**
	 * Manually entered address
	 */
	export let address: Chain.Bech32String = '';

	// // resolved contact
	// let g_contact: ContactStruct;

	// load contact def from store
	async function reload_contacts() {
		// load agents store
		const ks_agents = await Agents.read();

		// contact iterator
		const di_contacts = ks_agents.contacts($yw_chain_namespace);
// debugger;
// 		// contact is present
// 		if(g_contact) {
// 			// each contact
// 			for(const [p_contact_each, g_contact_each] of di_contacts) {
// 				// found match
// 				if(p_contact === p_contact_each) {
// 					g_contact = g_contact_each;
// 					break;
// 				}
// 			}
// 		}
		// only address was given
		if(!g_contact && address) {
			// each contact
			for(const [, g_contact_each] of di_contacts) {
				// check if address exists in contacts, found match
				if(address === Agents.addressFor(g_contact_each, $yw_chain)) {
					g_contact = g_contact_each;
					break;
				}
			}
		}
	}

	void reload_contacts();
	subscribe_store('agents', reload_contacts, onDestroy);


	// export let g_item: {
	// 	contact: Contact;
	// 	isGroupHeader?: boolean;
	// 	isGroupItem?: boolean;
	// 	isCreator?: boolean;
	// } | undefined = void 0;

	</script>
	
	<style lang="less">
		@import '../_base.less';
	
		.contact {
			display: flex;
			flex-direction: row;
			align-items: center;
			height: 100%;
	
			// padding-top: 3px;
			box-sizing: border-box;;
	
			>.contact-pfp {
				display: inline-flex;
				--proxy-icon-diameter: 26px;
				line-height: 26px;
				margin-right: 6px;
	
				>.icon {
					:global(&) {
						border-radius: 20%;
						display: inline-flex;
						align-items: center;
					}
	
					.global_icon-dom {
						:global(&) {
							height: unset;
							font-size: 14px; 
						}
					}
				}
			}
	
			>.info {
				display: flex;
				flex-direction: column;
				overflow: hidden;
				max-width: 172px;
	
				>.name {
					line-height: 1.2em;
				}
	
				>.address {
					:global(&) {
						// .font(mono-tiny);
						line-height: 1.2em;
						color: var(--theme-color-text-med);
					}
				}
			}
	
			// >* {
			// 	:global(&) {
			// 		vertical-align: middle;
			// 	}
			// }
		}
	
		.manual {
			.address {
				width: calc(100% - 3.5ch);
			}
		}
	</style>
	
	{#if g_contact}
		<div class="contact">
			<span class="contact-pfp">
				{#if g_contact}
					<PfpDisplay dim={28} resource={g_contact} genStyle='font-size:18px;' />
				{/if}
			</span>
	
			<span class="info">
				<span class="name">
					{g_contact.name}
				</span>
	
				<Address address={Agents.addressFor(g_contact, $yw_chain)} />
			</span>
		</div>
	{:else if address}
		<span class="manual">
			<Address address={address} />
		</span>
	{:else}
		<span class="warning">
			Failed to locate contact
		</span>
	{/if}