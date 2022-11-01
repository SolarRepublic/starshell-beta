import type {Merge} from 'ts-toolbelt/out/Object/Merge';
import type { AccountPath, AccountStruct } from './account';
import type { AppPath, AppStruct } from './app';
import type {Promisable} from './belt';
import type { Bech32, ChainPath, ChainStruct } from './chain';
import type {PfpTarget} from './pfp';

export type ResourceFieldRegistry = {
	app: {
		path: AppPath;
		struct: AppStruct;
	};

	chain: {
		path: ChainPath;
		struct: ChainStruct;
	};

	account: {
		path: AccountPath;
		struct: AccountStruct;
	};
};

export type ResourceFieldKey = keyof ResourceFieldRegistry;

export type FieldConfigRegistry = {
	key_value: {
		key: string;
		long?: boolean;
		value: Promisable<string | HTMLElement>;
		after?: HTMLElement[];
		subvalue?: Promisable<string>;
		render?: 'address' | 'mono';
		pfp?: PfpTarget;
	};

	memo: {
		text: string;
	};

	transaction: {
		hash: string;
		chain: ChainStruct;
		label?: string;
	};

	links: {
		value: Promisable<{
			href: string;
			text: string;
			icon?: string;
		}[]>;
	};

	password: {
		value: string;
		label?: string;
	};

	resource: Merge<{
		label?: string;
	}, {
		[si_each in ResourceFieldKey]: Merge<{
			resourceType: si_each;
		}, {
			path: ResourceFieldRegistry[si_each]['path'];
		} | {
			struct: ResourceFieldRegistry[si_each]['struct'];
		}>;
	}[ResourceFieldKey]>;

	contacts: {
		label?: string;
		bech32s: Bech32[];
		g_chain: ChainStruct;
	};

	contracts: {
		label?: string;
		bech32s: Bech32[];
		g_app: AppStruct;
		g_chain: ChainStruct;
	};

	dom: {
		dom: HTMLElement;
		title?: string;
		unlabeled?: boolean;
	};

	slot: {
		index: 0 | 1 | 2;
		data?: any;
	};

	gap: {};

	group: {
		fields: FieldConfig[];
		flex?: boolean;
		expanded?: boolean;
	};
};

export type FieldConfigKey = keyof FieldConfigRegistry;

export type FieldConfig<
	si_key extends FieldConfigKey=FieldConfigKey,
> = Promisable<{
	[si_each in FieldConfigKey]: Merge<FieldConfigRegistry[si_each], {
		type: si_each;
	}>;
}[si_key]>;
