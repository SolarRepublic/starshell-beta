import {SI_VERSION} from '#/share/constants';
import type {JsonObject, JsonValue} from '#/util/belt';
import {precedes} from './semver';

interface LastSeen {
	time: number;
	version: string;
}

type StorageSchema = {
	last_seen: {
		interface: LastSeen;
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

export function storage_get<w_value extends any=any>(si_key: string): Promise<w_value | null> {
	return new Promise((fk_resolve) => {
		chrome.storage.local.get([si_key], (h_gets) => {
			fk_resolve(h_gets[si_key] as w_value || null);
		});
	});
}

export function storage_set(h_set: JsonObject): Promise<void> {
	return new Promise((fk_resolve) => {
		chrome.storage.local.set(h_set, () => {
			fk_resolve();
		});
	});
}

export function storage_remove(si_key: string): Promise<void> {
	return async_callback(f => chrome.storage.local.remove(si_key, f));
}

export function storage_clear(): Promise<void> {
	return async_callback(f => chrome.storage.local.clear(f));
}


async function public_storage_get<w_value extends any=any>(si_key: PublicStorageKey): Promise<w_value | null> {
	return await storage_get<w_value>(`@${si_key}`);
}

function public_storage_put(si_key: PublicStorageKey, w_value: JsonValue): Promise<void> {
	return storage_set({
		[`@${si_key}`]: w_value,
	});
}

export const PublicStorage = {
	async lastSeen(): Promise<null | LastSeen> {
		return await public_storage_get<LastSeen>('last_seen');
	},

	async isUpgrading(): Promise<boolean> {
		const g_seen = await PublicStorage.lastSeen();

		return !g_seen || precedes(g_seen.version, SI_VERSION);
	},

	async markSeen(): Promise<void> {
		await public_storage_put('last_seen', {
			time: Date.now(),
			version: SI_VERSION,
		});
	},
};
