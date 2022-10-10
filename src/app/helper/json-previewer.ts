import type {Nameable, Pfpable} from '#/meta/able';
import type {Dict, JsonValue, Promisable} from '#/meta/belt';
import type {Bech32, ChainInterface} from '#/meta/chain';
import type { FieldConfig } from '#/meta/field';
import {RT_UINT, RT_URI_LIKELY, R_BECH32} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Agents} from '#/store/agents';
import {Chains} from '#/store/chains';
import {Contracts} from '#/store/contracts';
import {is_dict_es, ode, oderac} from '#/util/belt';
import {dd, qs, uuid_v4} from '#/util/dom';
import {svelte_to_dom} from '../svelte';
import Address from '../ui/Address.svelte';
import PfpDisplay from '../ui/PfpDisplay.svelte';

export interface PreviewerConfig {
	chain?: ChainInterface;
}

export function classify(s_value: string, s_class: string): HTMLSpanElement {
	return dd('span', {
		class: s_class,
	}, [s_value]);
}

// async function render_resource(g_resource: Nameable & Pfpable, si_class: string) {
// 	return dd('div', {
// 		class: `resource ${si_class}`,
// 	}, [
// 		await svelte_to_dom(PfpDisplay, {
// 			resource: g_resource,
// 			dim: 16,
// 		}, 'loaded'),

// 		classify(g_resource.name, `${si_class}-name`),
// 	]);
// }

// export async function load_inline_bech32(sa_find: Bech32, g_chain: ChainInterface): Promise<HTMLDivElement | null> {
// 	// chain path
// 	const p_chain = Chains.pathFrom(g_chain);

// 	// split bech32
// 	const [s_hrp, s_addr] = sa_find.split('1');

// 	// account
// 	try {
// 		const [p_account, g_account] = await Accounts.find(sa_find, g_chain);

// 		return await render_resource(g_account, 'account');
// 	}
// 	catch(e_find) {}

// 	// contact
// 	const p_contact = Agents.pathForContactFromAddress(sa_find);
// 	const g_contact = await Agents.getContact(p_contact);
// 	if(g_contact) {
// 		return await render_resource(g_contact, 'contact');
// 	}

// 	// contract
// 	const p_contract = Contracts.pathFor(p_chain, sa_find);
// 	const g_contract = await Contracts.at(p_contract);
// 	if(g_contract) {
// 		return await render_resource(g_contract, 'contract');
// 	}

// 	return null;
// }

export type RenderValue = JsonValue<Promise<JsonValue> | (() => Promisable<JsonValue>)>;

let xt_global_delay = 0;

export class JsonPreviewer {
	static render(
		z_value: JsonValue<Promise<JsonValue>>,
		gc_previewer: PreviewerConfig={},
		gc_field?: Dict
	): FieldConfig<'dom'> {
		const k_previewer = new JsonPreviewer(gc_previewer || {});

		return {
			type: 'dom',
			dom: k_previewer.render(z_value),
			...gc_field,
		} as const;
	}

	// protected _xt_delay = 0;

	constructor(protected _gc_previewer: PreviewerConfig) {}

	render_string(s_value: string) {
		return classify(JSON.stringify(s_value).replace(/^"|"$/, ''), 'json-string');
	}

	render(z_value: RenderValue, a_terms: boolean[]=[]): HTMLElement {
		const n_depth = a_terms.length;

		if(is_dict_es(z_value)) {
			const a_entries_dst: HTMLSpanElement[] = [];

			const a_entries_src = Object.entries(z_value).sort(([si_key_a, z_item_a], [si_key_b, z_item_b]) => {
				const n_sort = si_key_a.localeCompare(si_key_b);

				// string order: bech32, url, other, uint
				if('string' === typeof z_item_a) {
					if('string' === typeof z_item_b) {
						if(RT_UINT.test(z_item_a)) {
							return RT_UINT.test(z_item_b)? n_sort: 1;
						}
						else if(R_BECH32.test(z_item_a)) {
							return R_BECH32.test(z_item_b)? n_sort: -1;
						}
						else if(RT_UINT.test(z_item_b)) {
							return -1;
						}
						else if(R_BECH32.test(z_item_b)) {
							return 1;
						}
						else if(RT_URI_LIKELY.test(z_item_a)) {
							return RT_URI_LIKELY.test(z_item_b)? n_sort: -1;
						}
						else if(RT_URI_LIKELY.test(z_item_b)) {
							return 1;
						}

						return n_sort;
					}

					return -1;
				}

				if('string' === typeof z_item_b) {
					return 1;
				}
				else if('number' === typeof z_item_a) {
					return 'number' === typeof z_item_b? n_sort: -1;
				}

				if('number' === typeof z_item_b) {
					return 1;
				}
				else if('boolean' === typeof z_item_a) {
					return 'boolean' === typeof z_item_b? n_sort: -1;
				}

				if('boolean' === typeof z_item_b) {
					return 1;
				}
				else if(null === z_item_a) {
					return null === z_item_b? n_sort: -1;
				}

				if(null === z_item_b) {
					return 1;
				}
				else if(is_dict_es(z_item_a)) {
					return is_dict_es(z_item_b)? n_sort: -1;
				}

				if(is_dict_es(z_item_b)) {
					return 1;
				}
				else if(Array.isArray(z_item_a)) {
					return Array.isArray(z_item_b)? n_sort: -1;
				}

				if(Array.isArray(z_item_b)) {
					return 1;
				}

				return n_sort;
			});

			for(let i_key=0, nl_keys=a_entries_src.length; i_key<nl_keys; i_key++) {
				const [si_key, z_item] = a_entries_src[i_key];
				const b_terminal = i_key === nl_keys - 1;

				let a_spaces: never[] | [HTMLElement] = [];

				if(a_terms.length) {
					const a_drawings = a_terms.slice(1).map(b => dd('span', {
						class: 'drawing-block',
					}, [
						dd('span', {
							'class': 'drawing-fragment',
							'data-draw-left': b? '0': '1',
						}, []),
						dd('span', {
							'class': 'drawing-fragment',
							'data-draw-left': b? '0': '1',
						}, []),
					]));

					a_drawings.push(dd('span', {
						class: 'drawing-block',
					}, [
						dd('span', {
							'class': 'drawing-fragment',
							'data-draw-left': '1',
							'data-draw-bottom': '1',
						}, []),
						dd('span', {
							'class': 'drawing-fragment',
							'data-draw-left': b_terminal? '0': '1',
						}, []),
					]));

					a_spaces = [dd('span', {
						class: 'drawing-space',
					}, a_drawings)];
				}

				a_entries_dst.push(dd('div', {
					class: `json-entry ${is_dict_es(z_item)? 'nester': ''}`,
				}, [
					dd('span', {
						class: 'json-key',
					}, [
						...a_spaces,

						dd('span', {
							class: 'text',
						}, [si_key]),
					]),
					this.render(z_item, [...a_terms, b_terminal]),
				]));
			}

			const dm_grid = dd('div', {
				'class': `json-object ${n_depth? 'nested': ''}`,
				'data-json-depth': n_depth,
			}, a_entries_dst);

			return dm_grid;
		}
		else if(Array.isArray(z_value)) {
			const a_items: HTMLElement[] = [];

			for(const z_item of z_value) {
				a_items.push(dd('li', {}, [
					this.render(z_item, [...a_terms, false]),
				]));
			}

			const dm_list = dd('ul', {
				'class': `json-array ${n_depth? 'nested': ''}`,
				'data-json-depth': n_depth,
			}, a_items);

			return dm_list;
		}
		else if('string' === typeof z_value) {
			// unsigned integer
			if(RT_UINT.test(z_value)) {
				return classify(BigInt(z_value).toLocaleString(), 'uint');
			}

			// bech32
			const m_bech32 = R_BECH32.exec(z_value);
			if(m_bech32) {
				return dd('span', {
					'class': 'dynamic-inline-bech32',
					'data-bech32': z_value,
					'data-chain-path': this._gc_previewer.chain? Chains.pathFrom(this._gc_previewer.chain): '',
				}, [
					this.render_string(z_value),
				]);
			}
			// uri
			else if(RT_URI_LIKELY.test(z_value)) {
				if(z_value.startsWith('https://')) {
					return dd('a', {
						class: 'link',
						href: z_value,
					}, [
						z_value,
					]);
				}

				return classify(z_value, 'url');
			}
			// empty string
			else if('' === z_value) {
				return classify('empty string', 'empty-string');
			}
			// any other string
			else {
				return this.render_string(z_value);
			}
		}
		else if('number' === typeof z_value) {
			return classify(z_value+'', 'json-number');
		}
		else if('boolean' === typeof z_value) {
			return classify(z_value+'', 'json-boolean');
		}
		else if(null === z_value) {
			return classify(z_value+'', 'json-null');
		}
		// deferred value
		else if('function' === typeof z_value || z_value instanceof Promise) {
			const si_span = uuid_v4();

			const dm_span = dd('span', {
				id: si_span,
				class: 'dynamic-deferred-content',
				style: `
					animation-delay: ${(xt_global_delay += 150) - 150}ms;
				`,
			});

			// clean up after itself
			if(0 === xt_global_delay) {
				setTimeout(() => {
					xt_global_delay = 0;
				}, 150);
			}

			(async() => {
				const g_value = await ('function' === typeof z_value? z_value(): z_value);
				const dm_replace = this.render(g_value);

				document.getElementById(si_span)?.replaceWith(dm_replace);
			})();

			return dm_span;
		}
		// invalid json
		else {
			return classify(z_value+'', 'invalid');
			// throw new Error(`Invalid JSON value`);
		}
	}
}
