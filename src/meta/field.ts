import type {Merge} from 'ts-toolbelt/out/Object/Merge';
import type { AppInterface } from './app';
import type {Promisable} from './belt';
import type { Bech32, ChainInterface } from './chain';
import type {PfpTarget} from './pfp';

export type FieldConfigRegistry = {
	key_value: {
		key: string;
		long?: boolean;
		value: Promisable<string | HTMLElement>;
		after?: HTMLElement[];
		subvalue?: Promisable<string>;
		render?: 'address';
		pfp?: PfpTarget;
	};

	memo: {
		text: string;
	};

	links: {
		value: Promisable<{
			href: string;
			text: string;
			icon?: string;
		}[]>;
	};

	contacts: {
		label?: string;
		bech32s: Bech32[];
		g_chain: ChainInterface;
	};

	contracts: {
		label?: string;
		bech32s: Bech32[];
		g_app: AppInterface;
		g_chain: ChainInterface;
	};

	dom: {
		dom: HTMLElement;
		title?: string;
	};

	slot: {
		index: 0 | 1 | 2;
		data?: any;
	};

	gap: {};

	group: {
		fields: FieldConfig[];
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
