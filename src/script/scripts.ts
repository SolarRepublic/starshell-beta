import type browser from 'webextension-polyfill';
import type { Dict, JsonObject } from '#/util/belt';

import {
	locate_script,
} from './utils';

interface ScriptDefiner {
	(h_overrides?: Partial<browser.Scripting.RegisteredContentScript>): browser.Scripting.RegisteredContentScript;
}

const A_MATCH_ALL = [
	'file://*/*',
	'http://*/*',
	'https://*/*',
];

const G_SCRIPT_BASIC = {
	matches: A_MATCH_ALL,
	runAt: 'document_start',
	persistAcrossSessions: true,
	allFrames: true,
	world: 'MAIN',
} as const;


export const H_CONTENT_SCRIPT_DEFS: Dict<ScriptDefiner> = {
	// inpage_waker(h_overrides) {
	// 	return {
	// 		...G_SCRIPT_BASIC,
	// 		id: 'inpage_waker',
	// 		js: [
	// 			locate_script('assets/src/script/inpage-waker'),
	// 		],
	// 		...h_overrides,
	// 	};
	// },

	// inpage_iframe(h_overrides) {
	// 	return {
	// 		...G_SCRIPT_BASIC,
	// 		id: 'inpage_iframe',
	// 		js: [
	// 			locate_script('assets/src/script/inpage-iframe'),
	// 		],
	// 		...h_overrides,
	// 	};
	// },

	mcs_keplr(h_overrides) {
		return {
			...G_SCRIPT_BASIC,
			id: 'keplr_polyfill',
			js: [
				locate_script('assets/src/script/mcs-keplr'),
			],
			persistAcrossSessions: true,
			...h_overrides,
		};
	},
};
