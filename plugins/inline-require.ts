import path from 'path';

import {
	rollup,
} from 'rollup';

import type {
	Plugin,
	ResolvedConfig,
} from 'vite';

import * as walk from 'acorn-walk';

import { createFilter } from '@rollup/pluginutils';
import type { ModuleFormat } from '@sveltejs/vite-plugin-svelte';
import type { CallExpression, Identifier } from 'estree';
import MagicString from 'magic-string';
import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

interface Options {
	include?: string[];
	exclude?: string[];
	options?: {
		plugins?: Plugin[];
		output?: {
			format?: ModuleFormat;
			preferConst?: boolean;
			plugins?: Plugin[];
		},
		[prop: string]: any;
	};
}

const R_INLINE = /\$inline\('([^']+)'\)/g;

const PD_SRC = path.resolve(__dirname, '../src/');

const hm_cache = new Map();


export function inlineRequire(gc_import: Options={}) {
	const {
		include: a_include=[],
		exclude: a_exclude=[],
		// options: {
		// 	plugins: a_plugins=[],
		// 	output: gc_output={
		// 		format: 'iife',
		// 	},
		// 	// ...gc_input,
		// },
	} = gc_import;

	let gc_plugin: ResolvedConfig;

	const f_filter = createFilter(a_include, a_exclude);

	const si_cache = JSON.stringify({
		a_include,
		a_exclude,
	});

	if(hm_cache.has(si_cache)) {
		return hm_cache.get(si_cache);
	}


	return {
		name: 'inline-require',

		configResolved(gc_resolved) {
			gc_plugin = gc_resolved;
		},

		async transform(sx_code: string, si_part: string) {
			if(!f_filter(si_part)) return null;

			const y_magic = new MagicString(sx_code);

			const y_ast = this.parse(sx_code) as acorn.Node;

			const a_requires: {
				node: {
					start: number;
					end: number;
				};
				target: string;
			}[] = [];

			walk.simple(y_ast, {
				CallExpression(y_node) {
					const {
						arguments: a_args,
						callee: y_callee,
					} = y_node as unknown as CallExpression;

					const {
						type: si_type,
						name: s_name,
					} = y_callee as Identifier;

					// capture all `inline_require('something')`
					if('Identifier' === si_type
						&& 'inline_require' === s_name
						&& 1 === a_args.length
						&& 'Literal' === a_args[0].type)
					{
						const p_require = a_args[0].value as string;

						a_requires.push({
							node: {...y_node},
							target: p_require,
						});
					}
				},
			});

			const pd_part = path.dirname(si_part);

			for(const {target:p_target, node:g_node} of a_requires) {
				let g_resolve;

				// relative path
				if('.' === p_target[0]) {
					// attempt verbatim resolve
					g_resolve = await this.resolve(path.resolve(pd_part, p_target))

					// did not find file
					if(!g_resolve) {
						// try by appending .ts
						g_resolve = await this.resolve(path.resolve(pd_part, p_target+'.ts'));
					}
				}
				// root relative path
				else if('#' === p_target[0]) {
					debugger;
					// attempt verbatim resolve
					g_resolve = await this.resolve(path.resolve(PD_SRC, p_target.slice(2)))

					// did not find file
					if(!g_resolve) {
						// try by appending .ts
						g_resolve = await this.resolve(path.resolve(PD_SRC, p_target.slice(2)+'.ts'));
					}
				}
				// package
				else {
					g_resolve = await this.resolve(p_target);
				}

				// failed to resolve
				if(!g_resolve) {
					throw new Error(`Failed to resolve inline require "${p_target}" from ${pd_part}`);
				}

				let si_load = '';
				if(this.load) {
					const g_load = await this.load(g_resolve);
					si_load = g_load.id;
				}
				else {
					si_load = (g_resolve.id || '').replace(/\?.*$/, '');
				}

				const y_bundle = await rollup({
					input: si_load,
					plugins: [
						nodeResolve(),
						commonjs(),
						typescript({
							tsconfig: path.join(__dirname, '../tsconfig.json'),
							compilerOptions: {
								target: 'es2020',
							},
						}),
					],
				});

				const g_gen = await y_bundle.generate({
					format: 'iife',
				});

				y_magic.overwrite(g_node.start, g_node.end, g_gen.output[0].code);
			}

			return {
				code: y_magic.toString(),
				map: y_magic.generateMap({hires:true}),
			};
		},
	};
}
