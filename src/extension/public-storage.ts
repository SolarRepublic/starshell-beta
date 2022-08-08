import { SI_VERSION } from "#/share/constants";
import { precedes } from "./semver";

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


export async function storage_get<w_value extends any=any>(si_key: string): Promise<w_value | null> {
	const g_storage = await chrome.storage.local.get([si_key]) as {[si in typeof si_key]: w_value} | null;
	return g_storage?.[si_key] || null;
}

async function public_storage_get<w_value extends any=any>(si_key: PublicStorageKey): Promise<w_value | null> {
	return await storage_get<w_value>(`@${si_key}`);
}

async function public_storage_put(si_key: PublicStorageKey, w_value: any): Promise<void> {
	const si_wire = `@${si_key}`;
	await chrome.storage.local.set({
		[si_wire]: w_value,
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
	}
};
