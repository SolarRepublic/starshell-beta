import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

import {defineConfig, loadEnv} from 'vite';
import replace from '@rollup/plugin-replace';
import nodeResolve from '@rollup/plugin-node-resolve';
import analyze from 'rollup-plugin-analyzer'
import graph from 'rollup-plugin-graph';
import {svelte} from '@sveltejs/vite-plugin-svelte';
// import webExtension from '@solar-republic/vite-plugin-web-extension';
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


			// {
			// 	name: 'deep-seal',

			// 	writeBundle(g_opt, h_bundle) {
			// 		console.debug(`@@marker`);

			// 		for(const si_asset in h_bundle) {
			// 			const g_output = h_bundle[si_asset];
			// 			if('chunk' === g_output.type && !g_output.fileName.startsWith('assets/src/script/mcs-')) {
			// 				const sr_output = path.join(srd_out, g_output.fileName);

			// 				const sx_output = fs.readFileSync(sr_output);
			// 				fs.writeFileSync(sr_output, `${sx_deep_seal}\n${sx_output}`)
			// 			}
			// 		}
			// 	},
			// },

			graph({
				prune: true,
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

		// ...'ios' === SI_ENGINE? {
		// 	base: '../../',
		// }: {},

		build: {
			// sourcemap: ['safari', 'firefox'].includes(SI_ENGINE)? false: 'inline',
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
					// banner: `
					// 	${sx_deep_seal}
					// `,
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
	};
});