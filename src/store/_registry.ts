import type {StoreKey} from '#/meta/store';

import {Accounts} from './accounts';
import {Apps} from './apps';
import {Chains} from './chains';
import {Policies} from './policies';
import {Settings} from './settings';
import {Medias} from './medias';
import {Tags} from './tags';
import {Entities} from './entities';
import {Pfps} from './pfps';
import {WebApis} from './web-apis';

import {
	SI_STORE_CHAINS,
	SI_STORE_SETTINGS,
	SI_STORE_ACCOUNTS,
	SI_STORE_APPS,
	SI_STORE_APP_POLICIES,
	SI_STORE_MEDIA,
	SI_STORE_TAGS,
	SI_STORE_ENTITIES,
	SI_STORE_PFPS,
	SI_STORE_WEB_APIS,
	SI_STORE_PROVIDERS,
	SI_STORE_EVENTS,
} from '#/share/constants';
import {Providers} from './providers';
import {Incidents} from './incidents';

export const H_STORE_REGISTRY = {
	[SI_STORE_ACCOUNTS]: Accounts,
	[SI_STORE_APPS]: Apps,
	[SI_STORE_APP_POLICIES]: Policies,
	[SI_STORE_SETTINGS]: Settings,
	[SI_STORE_TAGS]: Tags,
	[SI_STORE_MEDIA]: Medias,
	[SI_STORE_PFPS]: Pfps,
	[SI_STORE_CHAINS]: Chains,
	[SI_STORE_EVENTS]: Incidents,
	[SI_STORE_PROVIDERS]: Providers,
	[SI_STORE_ENTITIES]: Entities,
	[SI_STORE_WEB_APIS]: WebApis,
} as const;

export type StoreRegistry<
	si_store extends StoreKey,
> = si_store extends keyof typeof H_STORE_REGISTRY
	? (typeof H_STORE_REGISTRY)[si_store]
	: never;

// type StoreInstance<
// 	as_keys extends StoreKey,
// > = Pick<StoreRegistry, as_keys> extends infer h_store_cls
// 	? {
// 		[si in keyof h_store_cls]: h_store_cls[si] extends Class<any[], object>
// 			? InstanceType<h_store_cls[si]> extends infer k_store
// 				? k_store extends WritableStore<si extends StoreKey? si: StoreKey>
// 					? k_store
// 					: never
// 				: never
// 			: never
// 	}
// 	: never;

// // type test = StoreInstance<'apps'>['apps']['release'];
