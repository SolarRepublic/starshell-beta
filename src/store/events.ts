
import {
	create_store_class,
	WritableStoreArray,
} from './_base';

import { R_BECH32, SI_STORE_CHAINS, SI_STORE_EVENTS } from '#/share/constants';
import { yw_chain } from '#/app/mem';
import { ode } from '#/util/belt';
import { base64_to_buffer, ripemd160_sync, sha256_sync } from '#/util/data';
import type { EventTypeKey, LogEvent } from '#/meta/store';
import type { AccountPath } from '#/meta/account';
import type { Bech32 } from '#/meta/chain';

export interface EventFilterConfig {
	type?: EventTypeKey;
	account?: AccountPath;
	owner?: Bech32.String;
}

export const Events = create_store_class({
	store: SI_STORE_EVENTS,
	extension: 'array',
	class: class EventsI extends WritableStoreArray<typeof SI_STORE_EVENTS> {
		static async filter(gc_filter: EventFilterConfig): Promise<IterableIterator<LogEvent>> {
			const ks_events = await Events.read() as EventsI;

			return ks_events.filter(gc_filter);
		}

		static async insert(g_event: LogEvent): Promise<number> {
			return await Events.open(ks => ks.insert(g_event));
		}

		* filter(gc_filter: EventFilterConfig={}): IterableIterator<LogEvent> {
			for(const g_event of this._w_cache as LogEvent[]) {
				if(gc_filter.type && gc_filter.type !== g_event.type) continue;
				if(gc_filter.account && gc_filter.account !== g_event.data['account']) continue;
				if(gc_filter.owner && gc_filter.owner !== g_event.data['owner']) continue;

				yield g_event;
			}
		}

		async delete(g_delete: LogEvent): Promise<number> {
			const a_events = this._w_cache as LogEvent[];

			const xt_delete = g_delete.time;

			const si_delete = JSON.stringify(g_delete);

			DELETION: {
				for(let i_event=0, nl_events=a_events.length; i_event<nl_events; i_event++) {
					const g_test = a_events[i_event];

					if(xt_delete === g_test.time) {
						// found entry
						if(si_delete === JSON.stringify(g_test)) {
							a_events.splice(i_event, 1);
							break DELETION;
						}
					}
				}

				// item was not found
				return a_events.length;
			}

			await this.save();

			return a_events.length;
		}

		async insert(g_event: LogEvent): Promise<number> {
			const xt_event = g_event.time;

			const a_events = this._w_cache as LogEvent[];

			const si_event = JSON.stringify(g_event);

			INSERTION: {
				for(let i_event=0, nl_events=a_events.length; i_event<nl_events; i_event++) {
					const g_test = a_events[i_event];

					if(xt_event > g_test.time) {
						a_events.splice(i_event, 0, g_event);
						break INSERTION;
					}
					// same exact millisecond
					else if(xt_event === g_test.time) {
						// duplicate event, abort
						if(si_event === JSON.stringify(g_test)) {
							return a_events.length;
						}
					}
				}

				// add event to list
				a_events.push(g_event);
			}

			// save changes
			await this.save();

			// return new list length
			return a_events.length;
		}
	},
});

