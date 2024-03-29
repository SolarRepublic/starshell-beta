import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import nodeResolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import webExtension from '@samrum/vite-plugin-web-extension';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import archiver from 'archiver';
import analyze from 'rollup-plugin-analyzer';
import graph from 'rollup-plugin-graph';
import {defineConfig, loadEnv} from 'vite';

import G_PACKAGE_JSON from './package.json';
import {inlineRequire} from './plugins/inline-require';
import {buildBrowserManifest} from './src/manifest';
import {
	base64_to_buffer, buffer_to_base58,
} from './src/util/data';

const H_REPLACEMENTS_ENGINE = {
	firefox: {
		'chrome.': 'browser.',
	},
};

const PD_MEDIA = path.join(__dirname, 'public', 'media');

function builtin_media(): Record<string, {hash: string; data: string}> {
	// prep output dict
	const h_out = {};

	// each media subdirectory
	['token', 'vendor', 'other'].forEach((sr_subdir) => {
		// subdirectory
		const pd_full = path.join(PD_MEDIA, sr_subdir);

		// each file in src directory
		for(const sr_file of fs.readdirSync(pd_full)) {
			// skip file
			if(!/\.(svg|png|webp)/.test(sr_file)) continue;

			if(sr_file.startsWith('icon_')) continue;

			// compute hash of file contents
			const sb64_sha256 = crypto.createHash('sha256')
				.update(fs.readFileSync(path.join(pd_full, sr_file)))
				.digest('base64');

			// convert to base58 to avoid `/` characters in encoding
			const sb58_sha256 = buffer_to_base58(base64_to_buffer(sb64_sha256));

			// update map
			h_out[`/media.image/sha256.${sb58_sha256}`] = {
				hash: sb58_sha256,
				data: `/media/${sr_subdir}/${sr_file}`,
			};
		}
	});

	// done
	return h_out;
}

// `defineConfig` is merely used to provide type hints in IDEs
export default defineConfig((gc_run) => {
	// destructure run config
	const {
		command: si_command,
		mode: si_mode,
	} = gc_run;

	// sensitive build values are stored in environment variables
	const {
		ENGINE: SI_ENGINE='chrome' as 'chrome' | 'firefox' | 'safari',
	} = {
		...loadEnv(si_mode, process.cwd(), ''),
		...process.env,
	};

	// build media dict
	const H_MEDIA_BUILTIN = builtin_media();

	// compute lookup table
	const H_MEDIA_LOOKUP = Object.fromEntries(Object.entries(H_MEDIA_BUILTIN).map(([si_key, g_media]) => [g_media.data, si_key]));

	const SI_BROWSER = SI_ENGINE;

	const srd_out = `dist/${SI_ENGINE}`;

	return {
		define: {
			__H_MEDIA_BUILTIN: JSON.stringify(H_MEDIA_BUILTIN),
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
				preventAssignment: false,
				values: H_REPLACEMENTS_ENGINE[SI_ENGINE] || {},
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
					...buildBrowserManifest('production' === si_mode)[SI_BROWSER].manifest,
				} as chrome.runtime.ManifestV2 & chrome.runtime.ManifestV3,
			}),

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

			...'firefox' === SI_ENGINE? [{
				name: 'zip-firefox',
				closeBundle() {
					return new Promise((fk_resolve) => {
						const ds_out = fs.createWriteStream(`${srd_out}.zip`);
						const y_archive = archiver('zip');
						y_archive.on('close', () => {
							fk_resolve(void 0);
						});
						y_archive.pipe(ds_out);
						y_archive.directory(`${srd_out}/`, false);
						y_archive.finalize();
					});
				},
			}]: [{}],
		],

		resolve: {
			alias: {
				'#': path.resolve(__dirname, './src'),
				'##': path.resolve(__dirname, './src/app'),
			},
		},

		build: {
			sourcemap: true,
			minify: 'production' === si_mode,
			emptyOutDir: true,
			outDir: srd_out,
			target: 'es2020',

			rollupOptions: {
				output: {
					// ...('firefox' === SI_ENGINE) && {
					// 	manualChunks: {
					// 		'html5-qrcode': ['html5-qrcode'],
					// 		'libsodium': ['libsodium'],
					// 		'bignumber.js': ['bignumber.js'],
					// 		'svelte-select': ['svelte-select'],
					// 		'ics-witness': ['src/script/ics-witness.ts'],
					// 		'@solar-republic/wasm-secp256k1': ['@solar-republic/wasm-secp256k1'],
					// 		'miscreant': ['miscreant'],
					// 		// '@keplr-wallet/provider': ['@keplr-wallet/provider'],
					// 	},
					// },
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
