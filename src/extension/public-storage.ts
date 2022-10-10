import {SI_VERSION} from '#/share/constants';
import type {JsonObject, JsonValue, Promisable} from '#/meta/belt';
import {precedes} from './semver';
import { base93_to_buffer, buffer_to_base93 } from '#/util/data';

interface LastSeen extends JsonObject {
	time: number;
	version: string;
}

type StorageSchema = {
	salt: {
		interface: string;
	};

	base: {
		interface: string;
	};

	installed: {
		interface: number;
	};

	last_seen: {
		interface: LastSeen;
	};

	// when enabled, allows Keplr to be detected and/or polyfilled
	keplr_compatibility_mode: {
		interface: boolean;
	};

	// when enabled, allows Keplr to be detected
	keplr_detection_mode: {
		interface: boolean;
	};

	// when enabled, polyfills Keplr unconditionally
	keplr_polyfill_mode: {
		interface: boolean;
	};

	/**
	 * When enabled, forces injection of main world content scripts where appropriate
	 */
	force_mcs_injection: {
		interface: boolean;
	};
};

type PublicStorageKey = keyof StorageSchema;

const async_callback = (f_action: (f: () => void) => void): Promise<any> => new Promise((fk_resolve, fe_reject) => {
	f_action(() => {
		if(chrome.runtime.lastError) {
			fe_reject(chrome.runtime.lastError);
		}
		else {
			fk_resolve(void 0);
		}
	});
});

export function storage_get_all(): Promise<JsonObject> {
	return chrome.storage.local.get(null);

	// return new Promise((fk_resolve) => {
	// 	chrome.storage.local.get(null, (h_all) => {
	// 		fk_resolve(h_all);
	// 	});
	// });
}

export async function storage_get<w_value extends any=any>(si_key: string): Promise<w_value | null> {
	return (await chrome.storage.local.get([si_key]))[si_key] || null;
	// return new Promise((fk_resolve) => {
	// 	chrome.storage.local.get([si_key], (h_gets) => {
	// 		fk_resolve(h_gets[si_key] as w_value || null);
	// 	});
	// });
}

export function storage_set(h_set: JsonObject): Promise<void> {
	return chrome.storage.local.set(h_set);
	// return new Promise((fk_resolve) => {
	// 	chrome.storage.local.set(h_set, () => {
	// 		fk_resolve();
	// 	});
	// });
}

export function storage_remove(si_key: string): Promise<void> {
	return chrome.storage.local.remove(si_key);
	// return async_callback(f => chrome.storage.local.remove(si_key, f));
}

export function storage_clear(): Promise<void> {
	return chrome.storage.local.clear();
	// return async_callback(f => chrome.storage.local.clear(f));
}


export async function public_storage_get<w_value extends any=any>(si_key: PublicStorageKey): Promise<w_value | null> {
	return await storage_get<w_value>(`@${si_key}`);
}

export function public_storage_put(si_key: PublicStorageKey, w_value: JsonValue): Promise<void> {
	return storage_set({
		[`@${si_key}`]: w_value,
	});
}

export function public_storage_remove(si_key: PublicStorageKey): Promise<void> {
	return storage_remove(`@${si_key}`);
}

async function getter_setter<
	si_key extends PublicStorageKey,
	w_value extends StorageSchema[si_key]['interface'] | null,
>(si_key: si_key, w_set?: w_value, fk_set?: () => Promisable<void>): Promise<w_value | null> {
	// set new state
	if('undefined' !== typeof w_set) {
		// update value in storage
		await public_storage_put(si_key, w_set);

		// set callback
		await fk_set?.();

		// return the set value
		return w_set;
	}
	// delete item
	else if(null === w_set) {
		await public_storage_remove(si_key);

		return null;
	}
	// getting state; fetch from storage
	else {
		return await public_storage_get(si_key) || null;
	}
}

export const PublicStorage = {
	async salt(atu8_salt?: Uint8Array | null): Promise<Uint8Array | undefined> {
		const s_salt = await getter_setter('salt', atu8_salt? buffer_to_base93(atu8_salt): void 0) || '';

		return s_salt? base93_to_buffer(s_salt): void 0;
	},

	// async base(atu8_salt?: Uint8Array | null): Promise<Uint8Array | undefined> {
	// 	const s_salt = await getter_setter('base', atu8_salt? buffer_to_base93(atu8_salt): void 0) || '';

	// 	return s_salt? base93_to_buffer(s_salt): void 0;
	// },

	async lastSeen(): Promise<null | LastSeen> {
		return await public_storage_get<LastSeen>('last_seen');
	},

	async isUpgrading(si_version=SI_VERSION): Promise<boolean> {
		const g_seen = await PublicStorage.lastSeen();

		return !g_seen || precedes(g_seen.version, si_version);
	},

	async markSeen(): Promise<void> {
		await public_storage_put('last_seen', {
			time: Date.now(),
			version: SI_VERSION,
		});
	},

	async installed(): Promise<number | null> {
		const xt_installed = await public_storage_get<number>('installed');

		if(!xt_installed) {
			await public_storage_put('installed', Date.now());
		}

		return xt_installed;
	},

	/**
	 * Enables/disables Keplr compatibility mode globally
	 */
	async keplrCompatibilityMode(b_enabled?: boolean): Promise<boolean> {
		return await getter_setter('keplr_compatibility_mode', b_enabled) || false;
	},

	/**
	 * Enables/disables Keplr detection mode globally
	 */
	async keplrDetectionMode(b_enabled?: boolean): Promise<boolean> {
		return await getter_setter('keplr_detection_mode', b_enabled) || false;
	},

	/**
	 * Enables/disables the unconditional polyfill of Keplr
	 */
	async keplrPolyfillMode(b_enabled?: boolean): Promise<boolean> {
		return await getter_setter('keplr_polyfill_mode', b_enabled) || false;
	},

	/**
	 * Enables/disables the unconditional polyfill of Keplr
	 */
	async forceMcsInjection(b_enabled?: boolean): Promise<boolean> {
		return await getter_setter('force_mcs_injection', b_enabled) || false;
	},
};
