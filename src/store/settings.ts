import {
	create_store_class,
	WritableStoreDict,
} from './_base';

import {SI_STORE_SETTINGS} from '#/share/constants';
import type {Dict} from '#/meta/belt';
import type { ChainPath } from '#/meta/chain';

export enum KeplrCompatibilityMode {
	DEFAULT = 0,
	EVERYWHERE = 1,
	NOWHERE = 2,
}

export type SettingsRegistry = {
	// 
	allow_file_urls?: boolean;

	// 
	e2e_encrypted_memos?: Partial<Record<ChainPath, {
		enabled: boolean;
		published: boolean;
	}>>;

	// 
	notice_send_encrypted_memo?: boolean;

	// 
	keplr_compatibility_mode?: KeplrCompatibilityMode;
};

export type SettingsKey = keyof SettingsRegistry;

export const Settings = create_store_class({
	store: SI_STORE_SETTINGS,
	extension: 'dict',
	class: class SettingsI extends WritableStoreDict<typeof SI_STORE_SETTINGS> {
		// static async get<si_key extends SettingsKey>(si_key: si_key): Promise<null | SettingsRegistry[si_key]> {
		// 	return await Settings.open((ks_settings) => ks_settings.get(si_key));
		// }

		// static async put<
		// 	si_key extends SettingsKey,
		// 	w_value extends SettingsRegistry[si_key],
		// >(si_key: si_key, w_value: w_value): Promise<void> {
		// 	return await Settings.open((ks_settings) => ks_settings.put(si_key, w_value));
		// }
	},
});
