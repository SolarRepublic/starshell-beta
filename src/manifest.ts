import type {ContentScripts} from 'webextension-polyfill';
import type { Values } from './meta/belt';

type ManifestV2 = chrome.runtime.ManifestV2;
type ManifestV3 = chrome.runtime.ManifestV3;

type Mv2ContentScript = Values<NonNullable<Required<ManifestV2>['content_scripts']>>;
type Mv3ContentScript = Values<NonNullable<Required<ManifestV3>['content_scripts']>>;

const H_CONTENT_SECURITY_POLICY = {
	'default-src': ['self'],
	'script-src': ['self', 'wasm-unsafe-eval'],
	'object-src': ['self'],
	'frame-ancestors': ['self', 'https://launch.starshel.net'],
};

function csp(h_merge: Record<string, string[]>={}): string {
	return Object.entries({
		...H_CONTENT_SECURITY_POLICY,
		...h_merge,
	}).reduce((a_out, [si_key, a_values]) => [
		...a_out,
		`${si_key} ${a_values.map(s => `'${s}'`).join(' ')}`,
	], []).join('; ');
}
// const SX_CONTENT_SECURITY_POLICY = `script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; object-src 'self'`;

const H_ICONS = {
	16: 'media/vendor/icon_16.png',
	19: 'media/vendor/icon_19.png',
	24: 'media/vendor/icon_24.png',
	32: 'media/vendor/icon_32.png',
	// 38: 'media/vendor/icon_38.png',
	48: 'media/vendor/icon_48.png',
	64: 'media/vendor/icon_64.png',
	// 96: 'media/vendor/icon_96.png',
	128: 'media/vendor/icon_128.png',
	256: 'media/vendor/icon_256.png',
	// 512: 'media/vendor/icon_512.png',
};

// const pd_media = path.resolve(__dirname, './media');
// fs.readdirSync(pd_media);

const A_MATCH_ALL = [
	'file://*/*',
	'http://*/*',
	'https://*/*',
];

const A_MATCH_LAUNCH = [
	'https://launch.starshell.net/*',
];

const A_MATCH_LINK = [
	'https://link.starshell.net/*',
];

type ContentScriptOverrides = Partial<ContentScripts.RegisteredContentScriptOptions | {world: 'MAIN' | 'ISOLATED'}>;

const G_CONTENT_SCRIPTS = {
	ics_spotter(h_overrides?: ContentScriptOverrides) {
		return {
			js: ['src/script/ics-spotter.ts'],
			matches: A_MATCH_ALL,
			run_at: 'document_start',
			all_frames: true,
			...h_overrides,
		};
	},

	mcs_relay() {
		return {
			js: ['src/script/mcs-relay.ts'],
			matches: [
				'file:///:never:',
			],
			run_at: 'document_start',
			all_frames: true,
		};
	},

	mcs_keplr(h_overrides?: ContentScriptOverrides) {
		return {
			js: ['src/script/mcs-keplr.ts'],
			matches: A_MATCH_ALL,
			run_at: 'document_start',
			all_frames: true,
			...h_overrides,
		};
	},

	ics_launch(h_overrides?: ContentScriptOverrides) {
		return {
			js: ['src/script/ics-launch.ts'],
			matches: A_MATCH_LAUNCH,
			run_at: 'document_start',
			...h_overrides,
		};
	},

	ics_link(h_overrides?: ContentScriptOverrides) {
		return {
			js: ['src/script/ics-link.ts'],
			matches: A_MATCH_LINK,
			run_at: 'document_start',
			...h_overrides,
		};
	},

	about_blank() {
		return {
			js: ['src/script/about-blank.ts'],
			matches: [
				'file:///:never',
			],
			run_at: 'document_start',
			match_about_blank: true,
			all_frames: true,
		};
	},
};

const G_MANIFEST_COMMON: Partial<chrome.runtime.ManifestBase> = {
	icons: H_ICONS,
	permissions: [
		'alarms',
		'storage',
		'tabs',
		'notifications',
		'system.display',
	],
};

const A_WA_RESOURCES = [
	'src/script/mcs-keplr.ts',
	'src/script/mcs-relay.ts',
	'src/entry/flow.html',
	'media/*',
];

const G_BROWSER_ACTION = {
	default_icon: H_ICONS,
	default_popup: 'src/entry/popup.html',
};

export const GC_MANIFEST_V2: Partial<ManifestV2> = {
	...G_MANIFEST_COMMON,
	manifest_version: 2,
	permissions: [
		...G_MANIFEST_COMMON.permissions,
		'*://*/*',
	],
	browser_action: G_BROWSER_ACTION,

	web_accessible_resources: [
		...A_WA_RESOURCES,
		G_BROWSER_ACTION.default_popup,
	],
	content_scripts: [
		G_CONTENT_SCRIPTS.ics_spotter(),
		G_CONTENT_SCRIPTS.ics_launch(),
		G_CONTENT_SCRIPTS.ics_link(),
		// G_CONTENT_SCRIPTS.mcs_keplr(),
	] as Mv2ContentScript[],
	background: {
		persistent: false,
		scripts: [
			'src/script/service.ts',
		],
	},
	content_security_policy: csp({
		'script-src': [...H_CONTENT_SECURITY_POLICY['script-src'], 'unsafe-eval'],
	}),
};

export const GC_MANIFEST_V3: Partial<ManifestV3> = {
	...G_MANIFEST_COMMON,
	permissions: [
		...G_MANIFEST_COMMON.permissions,
		'scripting',
	],
	manifest_version: 3,
	host_permissions: ['*://*/*'],
	action: G_BROWSER_ACTION,

	web_accessible_resources: [
		{
			resources: A_WA_RESOURCES,
			matches: A_MATCH_ALL,
		},
		{
			resources: [G_BROWSER_ACTION.default_popup],
			matches: A_MATCH_LAUNCH,
		},
	],
	content_scripts: [
		G_CONTENT_SCRIPTS.ics_spotter({
			world: 'ISOLATED',
		}),
		G_CONTENT_SCRIPTS.ics_launch({
			world: 'ISOLATED',
		}),
		G_CONTENT_SCRIPTS.ics_link({
			world: 'ISOLATED',
		}),
		// G_CONTENT_SCRIPTS.mcs_keplr({
		// 	world: 'MAIN',
		// }),
	] as Mv3ContentScript[],
	background: {
		service_worker: 'src/script/service.ts',
		type: 'module',
	},
	content_security_policy: {
		extension_pages: csp(),
	},
};

export const H_BROWSERS = {
	chrome: {
		manifest: {
			...GC_MANIFEST_V3,
		},
	},

	firefox: {
		manifest: {
			...GC_MANIFEST_V2,
			browser_specific_settings: {
				gecko: {
					id: 'wallet-beta@starshell.net',
				},
			},
		},
	},

	safari: {
		manifest: {
			...GC_MANIFEST_V2,
			permissions: [
				...GC_MANIFEST_V2.permissions || [],
				'nativeMessaging',
			],
		},
	},
} as const;
