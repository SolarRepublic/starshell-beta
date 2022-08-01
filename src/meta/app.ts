import type { List } from 'ts-toolbelt';
import type { Range } from 'ts-toolbelt/out/Number/Range';
import type { Merge } from 'ts-toolbelt/out/Object/Merge';
import type { Pfpable } from './able';
import type { Account, AccountPath } from './account';
import type { Chain, ChainPath } from './chain';
import type { Resource } from './resource';

export interface AppPermissionRegistry {
	doxx: {
		value: {};
	};
	storage: {
		value: {
			capacity?: {
				log2x: List.UnionOf<Range<10, 30>>;  // min: 1 Kib, max: 1 GiB
			};
		};
	};
}

export type AppPermissionKey = keyof AppPermissionRegistry;

export type AppPermissionSet = {
	[si_key in AppPermissionKey]: AppPermissionRegistry[si_key]['value'];
};

export interface AppSchemeRegistry {
	http: {};
	https: {};
	file: {};
}

export type AppSchemeKey = keyof AppSchemeRegistry;

export type AppChainConnection = {
	accounts: AccountPath[];
	permissions: Partial<AppPermissionSet>;
};

export type App<
	si_host extends string=string,
	s_scheme extends AppSchemeKey=AppSchemeKey,
> = Resource.New<{
	segments: [`scheme.${s_scheme}`, `host.${si_host}`];
	interface: Merge<{
		scheme: s_scheme;
		host: si_host;
		connections: Record<ChainPath, AppChainConnection>;
	}, Pfpable>;
}>;

export type AppPath = Resource.Path<App>;
