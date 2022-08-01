import {
	create_store_class,
	WritableStoreDict,
	WritableStoreMap,
} from './_base';

import { SI_STORE_AGENTS } from '#/share/constants';
import type { Resource } from '#/meta/resource';
import type { Contact, ContactPath } from '#/meta/contact';
import type { Agent, AgentPath, FamilyKey } from '#/meta/chain';
import { yw_chain, yw_family } from '#/app/mem';


export const Agents = create_store_class({
	store: SI_STORE_AGENTS,
	extension: 'map',
	class: class AgentsI extends WritableStoreMap<typeof SI_STORE_AGENTS> {
		static pathForAgent(sa_addr: string, si_family: FamilyKey=yw_family.get()): AgentPath {
			return `/family.${si_family}/agent.${sa_addr.replace(/^\w+1/, '')}`;
		}

		static pathForContact(sa_addr: string, si_family: FamilyKey=yw_family.get()): ContactPath {
			return `${AgentsI.pathForAgent(sa_addr, si_family)}/as.contact`;
		}

		static pathFromContact(g_contact: Contact['interface']): ContactPath {
			return AgentsI.pathForContact(g_contact.address, g_contact.family);
		}

		/**
		 * Loads agents store and finds the contact by its path
		 */
		static async getContact(p_contact: ContactPath): Promise<Contact['interface'] | null> {
			// read agents store
			const ks_agents = await Agents.read();

			// find contact
			return ks_agents.at(p_contact) as Contact['interface'];
		}

		* contacts(si_family: FamilyKey=yw_family.get()): IterableIterator<[ContactPath, Contact['interface']]> {
			// ref cache
			const h_cache = this._w_cache;

			// filter by family prefix
			const s_agent_prefix: AgentPath = `/family.${si_family}/agent.`;

			// each agent in cache
			for(const p_agent in h_cache) {
				// agent in different family; skip
				if(!p_agent.startsWith(s_agent_prefix)) continue;

				// not a contact; skip
				if(!p_agent.endsWith('/as.contact')) continue;

				// agent is a contact
				yield [p_agent as ContactPath, h_cache[p_agent]];
			}
		}

		async putContact(g_res: Contact['interface']): Promise<ContactPath> {
			// prepare contact path
			const p_res = AgentsI.pathFromContact(g_res);

			// update cache
			this._w_cache[p_res] = g_res;

			// attempt to save
			await this.save();

			// return path
			return p_res;
		}
	},
});
