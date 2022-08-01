import {
	create_store_class,
	WritableStoreDict,
} from './_base';

import { SI_STORE_SETTINGS } from '#/share/constants';


export type SettingsRegistry = {
	allow_file_urls?: boolean;
}

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
