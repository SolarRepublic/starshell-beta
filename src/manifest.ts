import type { ContentScripts } from 'webextension-polyfill';

type ManifestV2 = chrome.runtime.ManifestV2;
type ManifestV3 = chrome.runtime.ManifestV3;

const SX_CONTENT_SECURITY_POLICY = `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`;

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


const G_CONTENT_SCRIPTS = {
	ics_spotter(h_overrides?: Partial<ContentScripts.RegisteredContentScriptOptions | {world:'MAIN' | 'ISOLATED'}>) {
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

	web_accessible_resources: A_WA_RESOURCES,
	content_scripts: [
		G_CONTENT_SCRIPTS.ics_spotter() as Required<ManifestV2>['content_scripts'][number],
	],
	background: {
		persistent: false,
		scripts: [
			'src/script/service.ts',
		],
	},
	content_security_policy: SX_CONTENT_SECURITY_POLICY,
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
	],
	content_scripts: [
		G_CONTENT_SCRIPTS.ics_spotter({
			world: 'ISOLATED',
		}) as Required<ManifestV3>['content_scripts'][number],
	],
	background: {
		service_worker: 'src/script/service.ts',
		type: 'module',
	},
	content_security_policy: {
		extension_pages: SX_CONTENT_SECURITY_POLICY,
	},
};

export const H_BROWSERS = {
	chrome: {
		manifest: GC_MANIFEST_V3,
	},

	firefox: {
		manifest: {
			...GC_MANIFEST_V2,
			browser_specific_settings: {
				gecko: {
					id: 'wallet@starshell.net',
				},
			},
		},
	},

	safari: {
		manifest: GC_MANIFEST_V2,
	},
} as const;
