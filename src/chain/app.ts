import type {AppStruct} from '#/meta/app';

import {SessionStorage} from '#/extension/session-storage';
import type {AppProfile} from '#/store/apps';

export async function load_app_profile(g_app: AppStruct): Promise<AppProfile | void> {
	const p_profile = `profile:${g_app.scheme}://${g_app.host}` as const;

	const g_profile = await SessionStorage.get(p_profile);
	if(!g_profile) return;

	return g_profile as AppProfile;
}
