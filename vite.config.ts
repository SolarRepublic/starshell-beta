// this script runs in a Node.js environment
// the following imports leverage some built-in packages from Node.js
import path, { resolve } from 'path';
import fs from 'fs';
import crypto from 'crypto';

// some information about the package itself will be read from the package.json file
import G_PACKAGE_JSON from './package.json';

// Vite is the build system used to compile the output packages
// <https://vitejs.dev/>
import {
	defineConfig,
	loadEnv,
} from 'vite';

// import commonjs from '@rollup/plugin-commonjs';
// import nodeResolve from '@rollup/plugin-node-resolve';
// import inline from 'rollup-plugin-inline-js';

// Svelte is the Web App framework used to build user interfaces
// <https://svelte.dev/>
import {
	svelte,
} from '@sveltejs/vite-plugin-svelte';

// import typescript from '@rollup/plugin-typescript';
// import inlineCode from 'rollup-plugin-inline-code';
// console.log(inlineCode.default);

// import {
// 	extension,
// } from './vite/extension';

// supports building for web extension to multiple browsers
// import webExtension from '@solar-republic/vite-plugin-web-extension';
import webExtension from '@samrum/vite-plugin-web-extension';

// // inlined scripts are required to reach window before page scripts
// import { bundleImports } from 'rollup-plugin-bundle-imports';

// Chrome _requires_ Manifest V3, while other browsers do not even support it yet
import {
	H_BROWSERS,
} from './src/manifest';


import replace from '@rollup/plugin-replace';

import copy from 'rollup-plugin-copy';

import analyze from 'rollup-plugin-analyzer'

// proprietary plugin 
import { inlineRequire } from './plugins/inline-require';
import nodeResolve from '@rollup/plugin-node-resolve';

const H_REPLACEMENTS_BROWSER = {
	firefox: {
		'chrome.': 'browser.',
	},
};

const PD_MEDIA = path.join(__dirname, 'public', 'media');

function builtin_media(): Record<string, {hash:string; data:string;}> {
	// prep output dict
	const h_out = {};

	// each media subdirectory
	['chain', 'token', 'vendor', 'other'].forEach((sr_subdir) => {
		// subdirectory
		const pd_full = path.join(PD_MEDIA, sr_subdir);

		// each file in src directory
		for(const sr_file of fs.readdirSync(pd_full)) {
			// skip file
			if(!sr_file.endsWith('.svg') && !sr_file.endsWith('.png')) continue;

			if(sr_file.startsWith('icon_')) continue;

			// compute hash of file contents
			const si_sha256 = crypto.createHash('sha256')
				.update(fs.readFileSync(path.join(pd_full, sr_file)))
				.digest('hex');

			// update map
			h_out[`/media.image/sha256.${si_sha256}`] = {
				hash: si_sha256,
				data: `/media/${sr_subdir}/${sr_file}`,
			};
		}
	});

	// done
	return h_out;
}

// `defineConfig` is merely used to provide type hints in IDEs
export default defineConfig((gc_run) => {
	// the callback function above is used to control configuration depending on run target
	// destructure it
	const {
		command: si_command,
		mode: si_mode,
	} = gc_run;

	// sensitive build values are stored in environment variables
	const {
		PLATFORM: SI_PLATFORM='chrome' as 'chrome' | 'firefox' | 'firefox-android' | 'safari',
	} = {
		...loadEnv(si_mode, process.cwd(), ''),
		...process.env,
	};

	const SI_BROWSER = SI_PLATFORM.replace(/\-.+$/, '');

	// build media dict
	const H_MEDIA_BUILTINT = builtin_media();

	// compute lookup table
	const H_MEDIA_LOOKUP = Object.fromEntries(Object.entries(H_MEDIA_BUILTINT).map(([si_key, g_media]) => [g_media.data, si_key]));

	return {
		define: {
			__H_MEDIA_BUILTIN: JSON.stringify(H_MEDIA_BUILTINT),
			__H_MEDIA_LOOKUP: JSON.stringify(H_MEDIA_LOOKUP),
			__SI_VERSION: JSON.stringify(G_PACKAGE_JSON.version),
			__SI_PLATFORM: JSON.stringify(SI_PLATFORM),
		},

		plugins: [
			nodeResolve(),

			// apply the `inline_require()` substitution
			inlineRequire({
				// only on extensions scripts
				include: [
					'./src/script/*',
				],
			}),

			// replace
			replace({
				...H_REPLACEMENTS_BROWSER[SI_BROWSER] || {},
			}),

			// build svelte components
			svelte(),

			// build scripts and output manifest for web extension
			webExtension({
				manifest: {
					author: G_PACKAGE_JSON.author.name,
					description: G_PACKAGE_JSON.description,
					name: G_PACKAGE_JSON.displayName,
					version: G_PACKAGE_JSON.version,
					...H_BROWSERS[SI_BROWSER].manifest,
				} as chrome.runtime.ManifestV2 & chrome.runtime.ManifestV3,
			}),

			analyze({
				summaryOnly: true,
			}),
		],

		// optimizeDeps: {
		// 	exlucde: [
		// 		'@solar-republic/wasm-secp256k1',
		// 	],
		// },

		resolve: {
			alias: {
				'#': path.resolve(__dirname, './src'),
				'##': path.resolve(__dirname, './src/app'),
			},
		},

		build: {
			sourcemap: 'inline',
			minify: 'production' === si_mode,
			emptyOutDir: true,
			outDir: `dist/${SI_PLATFORM}`,
			target: 'es2020',

			rollupOptions: {
				output: {
					...SI_BROWSER.startsWith('firefox') && {
						manualChunks: {
							'bignumber.js': ['bignumber.js'],
							'svelte-select': ['svelte-select'],
						},
					},
			// 		preserveModules: true,
				},
			// 	preserveEntrySignatures: 'strict',
			},
		},
	};
});