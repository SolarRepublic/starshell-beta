import type {MergeAll} from 'ts-toolbelt/out/Object/MergeAll';

import type {ScreenInfo} from '#/extension/browser';
import type {JsonObject} from '#/meta/belt';
import {$_IS_SERVICE_WORKER} from '#/share/constants';
import type {Vocab} from '#/meta/vocab';
import type {IcsToService} from '#/script/messages';
import {F_NOOP} from '#/util/belt';

type SetWrapped = Partial<SessionStorage.Struct<'wrapped'>>;



export type SessionStorageRegistry = MergeAll<{
	/**
	 * Root AES key for all encrypted vault items
	 */
	root: {
		wrapped: number[];
	};

	/**
	 * 
	 */
	vector: {
		wrapped: number[];
	};

	/**
	 * Symmetric signing/verification key for opening iframed launch URLs
	 */
	auth: {
		wrapped: number[];
	};

	flow: {
		wrapped: string;
	};

	// cached screen display info
	display_info: {
		wrapped: ScreenInfo;
	};

	// compatibility mode flag for browsers that cannot register content scripts dynamically
	keplr_compatibility_mode_disabled: {
		wrapped: boolean;
	};

	// unconditional polyfill mode flag
	keplr_polyfill_mode_enabled: {
		wrapped: boolean;
	};

	// when the PWA was installed and opened
	pwa: {
		wrapped: number;
	};
}, [
	// {
	// 	[p_app in `app:${string}`]: {
	// 		wrapped: CachedAppState;
	// 	};
	// },

	{
		[si_mutex in `mutex:${string}`]: {
			wrapped: string;
		};
	},

	// used to pass favicon image data from a tab captured by a content script to the extension
	{
		[p_pfp in `pfp:${string}`]: {
			wrapped: string;
		};
	},

	// used to pass app profile data from a tab captured by a content script to the extension
	{
		[p_profile in `profile:${string}`]: {
			wrapped: JsonObject;
		};
	},

	// stores temporary nonces for tx error decryption
	{
		[p_nonce in `nonce:${string}`]: {
			wrapped: {
				nonce: string;
				time: number;
			};
		};
	},
]>;

export type SessionStorageKey = keyof SessionStorageRegistry;

export namespace SessionStorage {
	export type Wrapped<
		si_key extends SessionStorageKey=SessionStorageKey,
	> = SessionStorageRegistry[si_key] extends {wrapped: infer w_wrapped}
		? w_wrapped
		: never;

	export type Struct<
		si_which extends 'wrapped',
	> = {
		[si_key in SessionStorageKey]: {
			wrapped: Wrapped<si_key>;
		}[si_which];
	};
}



interface SynchronousExtSessionStorage {
	get(si_key: string): string | null;
	set(si_key: string, s_value: string): void;
	remove(si_key: string): void;
	clear(): void;
}

interface ExtSessionStorage {
	synchronously: null | SynchronousExtSessionStorage;

	get<si_key extends SessionStorageKey>(si_key: si_key): Promise<SessionStorage.Wrapped<si_key> | null>;
	set(h_set_wrapped: SetWrapped): Promise<void>;
	remove(si_key: SessionStorageKey): Promise<void>;
	clear(): Promise<void>;
}


export const SessionStorage = {} as ExtSessionStorage;

// eslint-disable-next-line @typescript-eslint/unbound-method
function resolve_storage_mechanism(b_force_background=false) {
	if(chrome.storage['session'] && !b_force_background) {
		const d_session = (chrome.storage as unknown as {
			session: chrome.storage.StorageArea;
		}).session;

		const g_exports: ExtSessionStorage = {
			async get<
				si_key extends SessionStorageKey,
			>(si_key: si_key): Promise<SessionStorage.Wrapped<si_key> | null> {
				return (await d_session.get([si_key]) as {
					[si in typeof si_key]: SessionStorage.Wrapped<si_key> | null;
				})[si_key];
			},

			async set(h_set_wrapped: SetWrapped): Promise<void> {
				return await d_session.set(h_set_wrapped);
			},

			async remove(si_key: SessionStorageKey): Promise<void> {
				return await d_session.remove(si_key);
			},

			async clear(): Promise<void> {
				return await d_session.clear();
			},

			synchronously: null,
		};

		// bug in older chrome forbids session storage access even from trusted contexts
		chrome.storage.session.get().then(F_NOOP, () => {
			// eslint-disable-next-line @typescript-eslint/unbound-method
			Object.assign(g_exports, resolve_storage_mechanism(true));
		});

		return g_exports;
	}
	else {
		const dw_background = chrome.extension.getBackgroundPage?.();
		let d_session!: Window['sessionStorage'];
		// within popup script; able to access "background page's" sessionStorage
		if(dw_background) {
			d_session = dw_background.sessionStorage;
		}
		// within "background page" (service worker); directly use sessionStorage object
		else if(globalThis[$_IS_SERVICE_WORKER]) {
			d_session = sessionStorage;
		}
		// within content script; send message to perform operation
		else {
			const d_runtime = chrome.runtime as Vocab.TypedRuntime<IcsToService.PublicVocab>;

			return {
				/* eslint-disable @typescript-eslint/require-await */
				get<si_key extends SessionStorageKey>(si_key: si_key): Promise<SessionStorage.Wrapped<si_key> | null> {
					return new Promise((fk_resolve) => {
						d_runtime.sendMessage({
							type: 'sessionStorage',
							value: {
								type: 'get',
								value: si_key,
							},
						}, (w_value: JsonObject) => {
							fk_resolve(w_value as SessionStorage.Wrapped<si_key> || null);
						});
					});
				},

				set(h_set_wrapped: SetWrapped): Promise<void> {
					return new Promise((fk_resolve) => {
						d_runtime.sendMessage({
							type: 'sessionStorage',
							value: {
								type: 'set',
								value: h_set_wrapped as JsonObject,
							},
						}, () => {
							fk_resolve();
						});
					});
				},

				remove(si_key: SessionStorageKey): Promise<void> {
					return new Promise((fk_resolve) => {
						d_runtime.sendMessage({
							type: 'sessionStorage',
							value: {
								type: 'remove',
								value: si_key,
							},
						}, () => {
							fk_resolve();
						});
					});
				},

				clear(): Promise<void> {
					return new Promise((fk_resolve) => {
						d_runtime.sendMessage({
							type: 'sessionStorage',
							value: {
								type: 'clear',
							},
						}, () => {
							fk_resolve();
						});
					});
				},

				synchronously: null,

				/* eslint-enable @typescript-eslint/require-await */
			};
		}

		const k_session: SynchronousExtSessionStorage = {
			get(si_key) {
				return d_session.getItem(si_key);
			},
			set(si_key, s_value) {
				return d_session.setItem(si_key, s_value);
			},
			remove(si_key) {
				return d_session.removeItem(si_key);
			},
			clear() {
				return d_session.clear();
			},
		};

		return {
			/* eslint-disable @typescript-eslint/require-await */
			async get<
				si_key extends SessionStorageKey,
			>(si_key: si_key): Promise<SessionStorage.Wrapped<si_key> | null> {
				const s_raw = k_session.get(si_key);
				return s_raw? JSON.parse(s_raw) as SessionStorage.Wrapped<si_key>: null;
			},

			async set(h_set_wrapped: SetWrapped): Promise<void> {
				for(const [si_key, w_value] of Object.entries(h_set_wrapped)) {
					k_session.set(si_key, JSON.stringify(w_value));
				}
			},

			async remove(si_key: SessionStorageKey): Promise<void> {
				k_session.remove(si_key);
			},

			async clear(): Promise<void> {
				k_session.clear();
			},

			synchronously: k_session,

			/* eslint-enable @typescript-eslint/require-await */
		};
	}
}

Object.assign(SessionStorage, resolve_storage_mechanism());
