import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

import {defineConfig, loadEnv} from 'vite';
import replace from '@rollup/plugin-replace';
import nodeResolve from '@rollup/plugin-node-resolve';
import analyze from 'rollup-plugin-analyzer'
import graph from 'rollup-plugin-graph';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import webExtension from '@samrum/vite-plugin-web-extension';

import G_PACKAGE_JSON from './package.json';
import {H_BROWSERS} from './src/manifest';
import {inlineRequire} from './plugins/inline-require';

const H_REPLACEMENTS_ENGINE = {
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
		ENGINE: SI_ENGINE='chrome' as 'chrome' | 'firefox' | 'safari' | 'ios',
	} = {
		...loadEnv(si_mode, process.cwd(), ''),
		...process.env,
	};

	// build media dict
	const H_MEDIA_BUILTINT = builtin_media();

	// compute lookup table
	const H_MEDIA_LOOKUP = Object.fromEntries(Object.entries(H_MEDIA_BUILTINT).map(([si_key, g_media]) => [g_media.data, si_key]));

	const SI_BROWSER = 'ios' === SI_ENGINE? 'safari': SI_ENGINE;

	const srd_out = `dist/${SI_ENGINE}`;

	// const sx_deep_seal = fs.readFileSync('./plugins/deep-seal/content.js');

	return {
		define: {
			__H_MEDIA_BUILTIN: JSON.stringify(H_MEDIA_BUILTINT),
			__H_MEDIA_LOOKUP: JSON.stringify(H_MEDIA_LOOKUP),
			__SI_VERSION: JSON.stringify(G_PACKAGE_JSON.version),
			__SI_ENGINE: JSON.stringify(SI_ENGINE),
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
				...H_REPLACEMENTS_ENGINE[SI_ENGINE] || {},
			}),

			// build svelte components
			svelte(),

			...'ios' === SI_ENGINE
				? [
					// viteSingleFile(),
				]
				// build scripts and output manifest for web extension
				: [
					webExtension({
						manifest: {
							author: G_PACKAGE_JSON.author.name,
							description: G_PACKAGE_JSON.description,
							name: G_PACKAGE_JSON.displayName,
							version: G_PACKAGE_JSON.version,
							...H_BROWSERS[SI_BROWSER].manifest,
						} as chrome.runtime.ManifestV2 & chrome.runtime.ManifestV3,
					}),
				],

			{
				name: 'bundle-mapper',

				generateBundle(gc_output, h_bundle) {
					const h_output = {};
					for(const g_module of Object.values(h_bundle)) {
						if('chunk' === g_module.type && g_module.facadeModuleId) {
							h_output[g_module.facadeModuleId?.slice(__dirname.length)] = g_module.fileName;
						}
					}

					fs.writeFileSync(`${srd_out}/bundle-map.json`, JSON.stringify(h_output, null, '\t'));
				},
			},

			graph({
				prune: true,
			}),

			analyze({
				summaryOnly: true,
			}),
		],

		resolve: {
			alias: {
				'#': path.resolve(__dirname, './src'),
				'##': path.resolve(__dirname, './src/app'),
			},
		},

		// ...'ios' === SI_ENGINE? {
		// 	base: '../../',
		// }: {},

		build: {
			sourcemap: true,
			minify: 'production' === si_mode,
			emptyOutDir: true,
			outDir: srd_out,
			target: 'es2020',

			rollupOptions: {
				...'ios' === SI_ENGINE && {
					input: {
						popup: 'src/entry/popup.html',
						flow: 'src/entry/flow.html',
					},
				},

				output: {
					...('firefox' === SI_ENGINE) && {
						manualChunks: {
							'html5-qrcode': ['html5-qrcode'],
							'libsodium': ['libsodium'],
							'bignumber.js': ['bignumber.js'],
							'svelte-select': ['svelte-select'],
							'ics-witness': ['src/script/ics-witness.ts'],
							'@solar-republic/wasm-secp256k1': ['@solar-republic/wasm-secp256k1'],
							'miscreant': ['miscreant'],
							// '@keplr-wallet/provider': ['@keplr-wallet/provider'],
						},
					},
			// 		preserveModules: true,
				},
			// 	preserveEntrySignatures: 'strict',
			},
		},

		test: {
			globals: true,
			environment: 'jsdom',
		},
	};
});