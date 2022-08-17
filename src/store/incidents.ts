import {
	create_store_class,
	WritableStore,
	WritableStoreMap,
} from './_base';

import { SI_STORE_INCIDENTS, SI_STORE_HISTORIES } from '#/share/constants';
import type { AccountPath } from '#/meta/account';
import type { Bech32, ChainPath } from '#/meta/chain';
import type { Incident, IncidentType, IncidentPath } from '#/meta/incident';
import { buffer_to_text, sha256_sync, text_to_buffer } from '#/util/data';
import type { SyncInfo } from '#/meta/store';

export interface IncidentFilterConfig {
	type?: IncidentType;
	account?: AccountPath;
	owner?: Bech32.String;
}

type IncidentDict = Record<IncidentPath, Incident.Struct>;

class HistoriesI extends WritableStore<typeof SI_STORE_HISTORIES> {
	static insertIncident(p_incident: IncidentPath, xt_when: number, h_incidents: IncidentDict): Promise<void> {
		return Histories.open(ks => ks.insertIncident(p_incident, xt_when, h_incidents));
	}

	static async incidents(): Promise<IncidentPath[]> {
		return (await Histories.read()).incidents();
	}

	static updateSyncInfo(p_chain: ChainPath, si_listen: string, s_height: string): Promise<void> {
		return Histories.open(ks => ks.updateSyncInfo(p_chain, si_listen, s_height));
	}

	static syncHeight(p_chain: ChainPath, si_listen: string): Promise<bigint> {
		return Histories.open(ks => ks.syncHeight(p_chain, si_listen));
	}

	async updateSyncInfo(p_chain: ChainPath, si_listen: string, s_height: string): Promise<void> {
		// ref cache
		const h_syncs = this._w_cache.syncs;

		// get-set info w/ height
		(h_syncs[p_chain] = h_syncs[p_chain] || {
			[si_listen]: {},
		})[si_listen] = {
			height: s_height,
		};

		// save to store
		await this.save();
	}

	syncHeight(p_chain: ChainPath, si_listen: string): bigint {
		// ref cache
		const h_syncs = this._w_cache.syncs;

		// lookup chain sync height info
		const s_height = h_syncs[p_chain]?.[si_listen]?.height;

		// no sync info
		if(!s_height) return 0n;

		// convert to bigint
		return BigInt(s_height);
	}

	async insertIncident(p_incident: IncidentPath, xt_when: number, h_incidents: IncidentDict): Promise<void> {
		// ref cache
		const a_incidents = this._w_cache.order;

		// exit conditions
		let b_sorted = false;
		let b_replaced = false;

		// each incident
		let nl_incidents = a_incidents.length;
		for(let i_each=0; i_each<nl_incidents; i_each++) {
			const p_each = a_incidents[i_each];

			// 
			const g_incident = h_incidents[p_each];

			// ref each's incident time
			const xt_each = g_incident.time;

			// found replacement
			if(p_each === p_incident) {
				// delete stale entry
				a_incidents.splice(i_each, 1);

				// update iteration length
				nl_incidents = a_incidents.length;

				// set exit condition
				b_replaced = true;

				// repeat on same index
				i_each -= 1;
				continue;
			}

			// insertion occurs more recently
			if(!b_sorted && xt_when >= xt_each) {
				// insert into position
				a_incidents.splice(i_each, 0, p_incident);

				// update iteration length
				nl_incidents = a_incidents.length;

				// set exit condition
				b_sorted = true;

				// skip already checked 'each'
				i_each += 1;
			}

			// exit conditions met
			if(b_sorted && b_replaced) break;
		}

		// did not sort
		if(!b_sorted) {
			a_incidents.push(p_incident);
		}

		console.log(`** History updated: [${a_incidents.join(', ')}]`);

		// save to store
		await this.save();
	}

	incidents(): IncidentPath[] {
		return this._w_cache.order;
	}
}

export const Histories = create_store_class({
	store: SI_STORE_HISTORIES,
	class: HistoriesI,
});

export const Incidents = create_store_class({
	store: SI_STORE_INCIDENTS,
	extension: 'map',
	class: class IncidentsI extends WritableStoreMap<typeof SI_STORE_INCIDENTS> {
		static pathFor(si_category: IncidentType, si_id: string): IncidentPath {
			return `/incident.${si_category}/id.${si_id}`;
		}

		static async filter(gc_filter: IncidentFilterConfig={}): Promise<IterableIterator<Incident.Struct>> {
			const [
				a_incidents,
				ks_incidents,
			] = await Promise.all([
				Histories.incidents(),
				Incidents.read(),
			]);

			return ks_incidents.filter(a_incidents, gc_filter);
		}

		static record(si_id: string | null, g_incident: Incident.Struct): Promise<void> {
			if(!si_id) {
				const atu8_hash = sha256_sync(text_to_buffer(JSON.stringify(g_incident)));
				si_id = `${g_incident.type}:${buffer_to_text(atu8_hash)}`;
			}

			return Incidents.open(ks => ks.record(si_id!, g_incident));
		}

		// static async delete(g_event: LogEvent): Promise<number> {
		// 	return await Incidents.open(ks => ks.delete(g_event));
		// }

		// static async insert(g_event: LogEvent): Promise<number> {
		// 	return await Incidents.open(ks => ks.insert(g_event));
		// }

		async record(si_id: string, g_incident: Incident.Struct, ks_histories?: HistoriesI): Promise<void> {
			// ref cache
			const h_incidents = this._w_cache as Record<IncidentPath, typeof g_incident>;

			// construct incident path
			const p_incident = IncidentsI.pathFor(g_incident.type, si_id);

			// overwrite cache entry
			h_incidents[p_incident] = g_incident;

			console.log(`+Recording ${p_incident} incident`);

			// save to store
			await this.save();

			console.log(`:Saved ${p_incident} incident`);

			// save in history's order
			if(ks_histories) {
				await ks_histories.insertIncident(p_incident, g_incident.time, this._w_cache as IncidentDict);
			}
			else {
				await Histories.insertIncident(p_incident, g_incident.time, this._w_cache as IncidentDict);
			}

			console.log(`~Inserted ${p_incident} incident`);
		}

		* filter(a_incidents: IncidentPath[], gc_filter: IncidentFilterConfig={}): IterableIterator<Incident.Struct> {
			const h_incidents = this._w_cache as IncidentDict;

			for(const p_incident of a_incidents) {
				const g_incident = h_incidents[p_incident];

				if(gc_filter.type && gc_filter.type !== g_incident.type) continue;
				if(gc_filter.account && gc_filter.account !== g_incident.data['account']) continue;
				if(gc_filter.owner && gc_filter.owner !== g_incident.data['owner']) continue;

				yield g_incident;
			}
		}

		// async delete(g_delete: LogEvent): Promise<number> {
		// 	const a_events = this._w_cache as LogEvent[];

		// 	const xt_delete = g_delete.time;

		// 	const si_delete = JSON.stringify(g_delete);

		// 	DELETION: {
		// 		for(let i_event=0, nl_events=a_events.length; i_event<nl_events; i_event++) {
		// 			const g_test = a_events[i_event];

		// 			if(xt_delete === g_test.time) {
		// 				// found entry
		// 				if(si_delete === JSON.stringify(g_test)) {
		// 					a_events.splice(i_event, 1);
		// 					break DELETION;
		// 				}
		// 			}
		// 		}

		// 		// item was not found
		// 		return a_events.length;
		// 	}

		// 	await this.save();

		// 	return a_events.length;
		// }

		// async insert(g_event: LogEvent): Promise<number> {
		// 	const xt_event = g_event.time;

		// 	const a_events = this._w_cache as LogEvent[];

		// 	const si_event = JSON.stringify(g_event);

		// 	INSERTION: {
		// 		for(let i_event=0, nl_events=a_events.length; i_event<nl_events; i_event++) {
		// 			const g_test = a_events[i_event];

		// 			if(xt_event > g_test.time) {
		// 				a_events.splice(i_event, 0, g_event);
		// 				break INSERTION;
		// 			}
		// 			// same exact millisecond
		// 			else if(xt_event === g_test.time) {
		// 				// duplicate event, abort
		// 				if(si_event === JSON.stringify(g_test)) {
		// 					return a_events.length;
		// 				}
		// 			}
		// 		}

		// 		// add event to list
		// 		a_events.push(g_event);
		// 	}

		// 	// save changes
		// 	await this.save();

		// 	// return new list length
		// 	return a_events.length;
		// }
	},
});

