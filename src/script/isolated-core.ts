import type {Dict, JsonObject, JsonValue} from '#/meta/belt';
import {ode, timeout} from '#/util/belt';
import {is_dict} from '#/util/belt';

import type {ConnectionManifestV1, ContractDescriptor, SessionRequest} from '#/meta/api';
import type {Bech32, Caip2, ChainInterface, ChainNamespaceKey, ContractInterface} from '#/meta/chain';

import {A_CHAIN_NAMESPACES, B_SAFARI_MOBILE, G_USERAGENT, N_PX_DIM_ICON, RT_CAIP_2_NAMESPACE, RT_CAIP_2_REFERENCE, R_BECH32, R_CAIP_10, R_CAIP_19, R_CAIP_2, R_CHAIN_ID_VERSION, R_CHAIN_NAME, R_CONTRACT_NAME, R_DATA_IMAGE_URL_WEB, R_TOKEN_SYMBOL} from '#/share/constants';
import type {Vocab} from '#/meta/vocab';
import type {IcsToService} from './messages';
import type {PfpTarget} from '#/meta/pfp';
import type {AppProfile} from '#/store/apps';
import {load_icon_data} from './utils';
import {qs, qsa, uuid_v4} from '#/util/dom';
// import {Chains} from '#/store/chains';
import toml from 'toml';
import type { TokenSpecKey } from '#/meta/token';
import { concat, sha256, sha256_sync, text_to_buffer } from '#/util/data';
import { SessionStorage } from '#/extension/session-storage';


// verbose
const logger = si_channel => (s: string, ...a_args: any[]) => console[si_channel](`StarShelll.isolated-core: ${s}`, ...a_args as unknown[]);
const debug = logger('debug');
const error = logger('error');
// const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.isolated-core: ${s}`, ...a_args as unknown[]);
// const error = (s: string, ...a_args: any[]) => console.error(`StarShell.isolated-core: ${s}`, ...a_args as unknown[]);

const R_CHAIN_ID_WHITELIST = /^(kava_[1-9]\d*-|shentu-[1-9][0-9]*\.)[1-9]\d*$/;


const d_runtime = chrome.runtime as Vocab.TypedRuntime<IcsToService.PublicVocab>;

export const ServiceRouter = {
	async connect(g_manifest: ConnectionManifestV1): Promise<{}> {
		debug(`Evaluating connection manifest: %o`, g_manifest);

		// invalid structure
		if(!is_dict(g_manifest) || 'string' !== typeof g_manifest.schema) {
			throw new Error('Invalid manifest structure');
		}

		// unknown manifest version
		if('1' !== g_manifest.schema) {
			throw new Error('Unknown or unsupported manifest schema version');
		}

		// missing chains
		if(!is_dict(g_manifest.chains) || !Object.keys(g_manifest.chains).length) {
			throw new Error('No chains were specified in request');
		}

		// destructure manifest
		const {
			chains: h_chains_manifest,
			sessions: h_sessions_manifest,
		} = g_manifest;

		// valid chains
		const h_chains_valid: Record<Caip2.String, ChainInterface> = {};

		// chain errors
		const h_chains_error: Dict<{
			error: string;
			chain: unknown;
		}> = {};

		// // chain answers
		// const a_answers: Vocab.MessageValue<HostToRelay.AuthedVocab, 'respondConnect'>['answer'][] = [];

		// // read existing chains from store
		// const ks_chains = await Chains.read();

		// each chain
		for(const si_key in h_chains_manifest) {
			// ref supplied chain value
			const g_chain = h_chains_manifest[si_key as Caip2.String];

			// prep error handling convenience methods
			const creject = (s_reason: string) => h_chains_error[si_key] = {error:s_reason, chain:g_chain};
			const cerr = (s_reason: string) => new Error(`${s_reason} at .chains["${si_key}"]`);

			// validate descriptor structure
			if(!is_dict(g_chain) || 'string' !== typeof g_chain.namespace || 'string' !== typeof g_chain.reference) {
				throw cerr('Invalid chain identification');
			}

			// CAIP-2 identifier
			const si_caip2 = `${g_chain.namespace}:${g_chain.reference}` as const;

			// key mismatch
			if(si_key !== si_caip2) {
				throw cerr(`Chain's CAIP-2 identifiers do not match: "${si_key}" != "${si_caip2}"`);
			}

			// family not supported
			if(!A_CHAIN_NAMESPACES.includes(g_chain.namespace)) {
				creject(`"${g_chain.namespace}" namespace not supported`);

				// move onto next chain
				continue;
			}

			// // validate chain category
			// if(!A_CHAIN_CATEGORIES.includes(g_chain.category)) {
			// 	return cerr(`Invalid category value "${g_chain.category}"; must be one of (${A_CHAIN_CATEGORIES.join(', ')})`);
			// }

			// validate chain id
			if(!R_CHAIN_ID_VERSION.test(g_chain.reference)) {
				// whitelisted
				if(R_CHAIN_ID_WHITELIST.test(g_chain.reference)) {
					// ignore it
					creject(`"${g_chain.reference}" does not follow the CAIP-2 chain id specification and is not supported at this time`);

					// move onto next chain
					continue;
				}
				// invalid chin id
				else {
					throw cerr(`Invalid chain id "${g_chain.reference}" for ${g_chain.namespace} family; failed to match regular expression /${R_CHAIN_ID_VERSION.source}/`);
				}
			}

			// validate chain name if defined
			if('name' in g_chain && 'undefined' !== typeof g_chain) {
				if('string' !== typeof g_chain.name) {
					throw cerr('Invalid chain name is not a string');
				}

				if(!R_CHAIN_NAME.test(g_chain.name)) {
					throw cerr(`Invalid chain name "${g_chain.name}"; failed to match regular expression /${R_CHAIN_NAME.source}/`);
				}

				if(g_chain.name.length > 64) {
					throw cerr('Chain name too long');
				}
			}

			// fix chain name
			const s_name = g_chain.name?.replace(/^\s+|\s+$/g, '') || g_chain.reference;

			// sanitize chain pfp if defined
			if('pfp' in g_chain) {
				const s_pfp = '' as PfpTarget;

				// truthy
				if(g_chain.pfp) {
					// not a string
					if('string' !== typeof g_chain.pfp) {
						throw cerr('Invalid chain pfp is not a string');
					}

					// must be a valid data URL
					if(!R_DATA_IMAGE_URL_WEB.test(g_chain.pfp)) {
						throw cerr('Invalid chain pfp must be "data:image/png;base64,..."');
					}
				}

				g_chain.pfp = s_pfp;
			}

			// // chain already exists in wallet
			// const p_chain = Chains.pathFrom(g_chain);
			// const g_chain_existing = ks_chains.at(p_chain);
			// if(g_chain_existing) {
			// 	// replace with existing
			// 	g_chain = g_chain_existing;

			// 	// TODO: find differences
			// }

			// commit to valid chains
			h_chains_valid[si_caip2] = {
				...g_chain,
				name: s_name,
			};
		}

		// valid session requests
		const h_sessions_valid: Dict<SessionRequest> = {};

		// invalid session requests
		const h_sessions_error: Dict<{
			error: string;
			session: unknown;
		}> = {};

		// set of used chains
		const as_chains_used = new Set<Caip2.String>();

		// each session request
		for(const si_key in h_sessions_manifest) {
			// ref supplied session request value
			const g_req_read = h_sessions_manifest[si_key];

			// prep error handling convenience methods
			const creject = (s_reason: string) => h_sessions_error[si_key] = {error:s_reason, session:g_req_read};
			const cerr = (s_reason: string) => new Error(`${s_reason} at .sessions["${si_key}"]`);

			// validate request structure
			if(!is_dict(g_req_read)) throw cerr('Invalid session request');

			// validate caip2 identifier
			const si_caip2 = g_req_read.caip2;
			if('string' !== typeof si_caip2) {
				throw cerr('Missing .caip2 identifier');
			}

			// chain isn't valid
			if(!h_chains_valid[si_caip2]) {
				// chain is missing from manifest
				if(!(si_caip2 in h_chains_manifest)) {
					creject(`No "${si_caip2}" chain was found in the manifest`);
					continue;
				}
				// chain had an invalid definition
				else {
					creject(`The "${si_caip2}" chain definition was invalid`);
					continue;
				}
			}

			// prep sanitized version
			const g_req_write: SessionRequest = {
				caip2: si_caip2,
			};

			// only keep recognized members
			if('doxx' in g_req_read) {
				const g_doxx_read = g_req_read.doxx;

				// validate
				if(!is_dict(g_doxx_read)) throw cerr(`Invalid type for .doxx property`);

				// prep sanitized version
				const g_doxx_write: SessionRequest['doxx'] = g_req_write.doxx = {};

				// address property
				if('address' in g_doxx_read) {
					const g_addr_read = g_doxx_read.address;

					// validate
					if(!is_dict(g_addr_read)) throw cerr(`Invalid type for .doxx.address property`);

					// missing justification
					if('string' !== typeof g_addr_read.justification) {
						throw cerr(`Missing string value for .doxx.address.justification`);
					}

					// too long
					if(g_addr_read.justification.length > 280) {
						throw cerr(`Justification string limited to 280 characters maximum.`);
					}

					// copy to sanitized version
					g_doxx_write.address = {
						justification: g_addr_read.justification,
					};
				}

				// name property exists and is truthy
				if(g_doxx_read.name) {
					g_doxx_write.name = {};
				}
			}

			// 
			if('query' in g_req_read) {
				const g_query_read = g_req_read.query;

				// validate
				if(!is_dict(g_query_read)) throw cerr(`Invalid type for .query property`);

				// prep sanitized version
				const g_query_write: SessionRequest['query'] = g_req_write.query = {};

				// node property
				if('node' in g_query_read) {
					const g_node_read = g_query_read.node;

					// validate
					if(!is_dict(g_node_read)) throw cerr(`Invalid type for .query.node property`);

					// missing justification
					if('string' !== typeof g_node_read.justification) {
						throw cerr(`Missing string value for .query.node.justification`);
					}

					// too long
					if(g_node_read.justification.length > 280) {
						throw cerr(`Justification string limited to 280 characters maximum.`);
					}

					// copy to sanitized version
					g_query_write.node = {
						justification: g_node_read.justification,
					};
				}
			}

			// 
			if('broadcast' in g_req_read) {
				const g_broadcast_read = g_req_read.broadcast;

				// validate
				if(!is_dict(g_broadcast_read)) throw cerr(`Invalid type for .broadcast property`);

				// set
				g_req_write.broadcast = {};
			}

			// TODO: validate other request members

			// set sanitized version
			h_sessions_valid[si_key] = g_req_write;
		}

		// go async
		return new Promise((fk_resolve, fe_reject) => {
			// send connection requestion to service
			d_runtime.sendMessage({
				type: 'requestConnection',
				value: {
					chains: h_chains_valid,
					sessions: h_sessions_valid,
				},
			}, (w_response) => {
				fk_resolve(w_response);
			});
		});
	},
};


interface DestructuredLink {
	href: string;
	value: string;
}

export function* destructure_links(si_data_key: string): IterableIterator<DestructuredLink> {
	for(const dm_link of qsa(document.head, `link[rel="prefetch"][as="image"][data-${si_data_key}]`)) {
		const g_link = {
			href: dm_link.getAttribute('href'),
			value: dm_link.dataset[si_data_key],
		};

		if(g_link.href && g_link.value) yield g_link as DestructuredLink;
	}
}

let A_WORDLIST: string[] | null = null;

function abbreviate_word(s_word: string) {
	// shorten
	if(s_word.length > 4) {
		// remove vowels that do not start word
		s_word = s_word.replace(/(.)[aeiou]/g, '$1');

		// still too long; truncate
		if(s_word.length > 6) s_word = s_word.slice(0, 6);
	}

	return s_word.toUpperCase();
}

async function generate_token_symbol(sa_token: Bech32) {
	// have not tried loading lis yet
	if(!A_WORDLIST) {
		// attempt to fetch
		try {
			const d_res = await fetch(chrome.runtime.getURL('data/bip-0039-english.txt'));

			// response succeeded
			if(d_res?.ok) {
				// parse text
				const s_text = await d_res.text();

				// split by newline and save
				A_WORDLIST = s_text.split('\n');
			}
		}
		// fail-safe
		catch(e_fetch) {}

		// did not work; do not try again
		if(!A_WORDLIST) A_WORDLIST = [];
	}

	// contract suffix
	let s_contract_suffix = '';

	// abbreviate host parts
	const a_host = location.host.split(/[^\p{L}\p{N}]/u).map(abbreviate_word).reverse();

	// hash token address
	const atu8_sha256 = sha256_sync(text_to_buffer(sa_token));

	// wordlist available
	if(A_WORDLIST?.length) {
		// use the first 3 bytes (24 bits) of hash to pick from wordlist so there is no modulo bias in 2048 words
		const ab_entropy = concat([Uint8Array.from([0]), atu8_sha256.subarray(0, 3)]).buffer;

		// convert to 24-bit index and module by length of word list (2048)
		const i_word = new DataView(ab_entropy).getUint32(0) % A_WORDLIST.length;

		// find word and abbreviate it
		s_contract_suffix = abbreviate_word(A_WORDLIST[i_word]);
	}
	// wordlist not available; fallback to using random entropy
	else {
		s_contract_suffix = abbreviate_word(uuid_v4().replace(/[ae-]/g, ''));
	}

	// construct final output
	return [...a_host.slice(1, 3), s_contract_suffix].join('-');
}

/**
 * Pre-emptively renders and loads the page's pfp in case the user decides to interact with the page
 */
export async function load_app_pfp(): Promise<void> {
	// grab site pfp
	const sq_icons = ['icon', 'apple-touch-icon'].map(s => `head link[rel="${s}"]`).join(',');
	const a_icons = [...document.querySelectorAll(sq_icons)] as HTMLLinkElement[];

	// 
	let dm_selected: HTMLLinkElement | null = null;
	let x_max = 0;

	// each icon
	for(const dm_icon of a_icons) {
		// icon has sizes attribute set
		const sx_sizes = dm_icon.getAttribute('sizes');
		if(sx_sizes) {
			// each size listed
			for(const sx_size of sx_sizes.split(/\s+/)) {
				// parse dimensions
				const m_dims = /^(\d+)x(\d+)$/.exec(sx_size);

				// failed to parse or not square; skip
				if(!m_dims || m_dims[1] !== m_dims[2]) continue;

				// parse integer
				const x_dim = +m_dims[1];

				// larger than largest but still within range; select icon
				if(x_dim > x_max && x_dim <= 2 * N_PX_DIM_ICON) {
					x_max = x_dim;
					dm_selected = dm_icon;
				}
			}
		}
		// nothing else is selected yet
		else if(!dm_selected) {
			dm_selected = dm_icon;
		}
		// this variant is a (typically) higher resolution apple-touch-icon
		else if('apple-touch-icon' === dm_icon.getAttribute('rel')) {
			if(dm_selected.getAttribute('type')?.startsWith('image/png')) {
				dm_selected = dm_icon;
			}
		}
		// svg can be scaled; prefer it
		else if(dm_icon.getAttribute('type')?.startsWith('image/svg')) {
			dm_selected = dm_icon;
		}
	}

	// an icon was selected
	if(dm_selected) {
		// load its image data into a data URL
		const p_data = await load_icon_data(dm_selected.href, N_PX_DIM_ICON) || '';

		// okay to use
		if(p_data) {
			// save pfp data URL to session storage
			const p_pfp = `pfp:${location.origin}` as const;

			// @ts-expect-error TypeScript doesn't understand
			await SessionStorage.set({
				[p_pfp]: p_data,
			});
		}
	}

	// set basic profile
	await SessionStorage.set({
		[`profile:${location.origin}`]: {
			...await SessionStorage.get(`profile:${location.origin}`),
			name: document.head?.querySelector('meta[name="application-name"]')?.getAttribute('content'),
		},
	});
}


export async function create_app_profile(): Promise<AppProfile> {
	// load all links
	const a_res_entries = await Promise.all([
			// each caip-2 link
		...[...destructure_links('caip-2')].map(async({href:p_href, value:si_caip2}) => {
			// invalid CAIP-2
			if(!R_CAIP_2.test(si_caip2)) return;

			// load its image data into a data URL
			const sx_data = await load_icon_data(p_href);

			// not okay to use
			if(!sx_data) return;

			// save pfp data URL to session storage
			const p_pfp = `pfp:${location.origin}/${si_caip2}` as const;

			// @ts-expect-error TypeScript doesn't understand
			await SessionStorage.set({
				[p_pfp]: sx_data,
			});

			// return [key, value] entry for later conversion to dict
			return [si_caip2, p_pfp];
		}),

		// each caip-10 link
		...[...destructure_links('caip-10')].map(async({href:p_href, value:si_caip10}) => {
			// invalid CAIP-10
			if(!R_CAIP_10.test(si_caip10)) return;

			// load its image data into a data URL
			const sx_data = await load_icon_data(p_href);

			// not okay to use
			if(!sx_data) return;

			// save pfp data URL to session storage
			const p_pfp = `pfp:${location.origin}/${si_caip10}` as const;

			// @ts-expect-error TypeScript doesn't understand
			await SessionStorage.set({
				[p_pfp]: sx_data,
			});

			// return [key, value] entry for later conversion to dict
			return [si_caip10, p_pfp];
		}),

		// each caip-19 link
		...[...destructure_links('caip-19')].map(async({href:p_href, value:si_caip19}) => {
			// invalid CAIP-19
			if(!R_CAIP_19.test(si_caip19)) return;

			// load its image data into a data URL
			const sx_data = await load_icon_data(p_href);

			// not okay to use
			if(!sx_data) return;

			// save pfp data URL to session storage
			const p_pfp = `pfp:${location.origin}/${si_caip19}` as const;

			// @ts-expect-error TypeScript doesn't understand
			await SessionStorage.set({
				[p_pfp]: sx_data,
			});

			// return [key, value] entry for later conversion to dict
			return [si_caip19, p_pfp];
		}),
	]);

	console.debug(`App profiler finished scanning links in head`);

	// prep sanitized contract def dict
	const h_contract_defs: Dict<ContractInterface> = {};

	// each valid whip-003 script
	for(const dm_script of qsa(document.head, ['toml', 'json'].map(s => `script[type^="application/${s}"][data-whip-003]`).join(',')) as HTMLScriptElement[]) {
		// parsed content
		let g_parsed: JsonValue = null;

		// toml script
		if(/^application\/toml\b/.test(dm_script.type.toLowerCase())) {
			// attempt to parse the script
			try {
				g_parsed = toml.parse(dm_script.textContent || '') as JsonObject;
			}
			// parsing error; log error and skip
			catch(e_parse) {
				error(`TOML parsing error on WHIP-003 script: ${e_parse.stack}`);
				continue;
			}
		}
		// json script
		else if(/^application\/json\b/.test(dm_script.type.toLowerCase())) {
			// attempt to parse the script
			try {
				g_parsed = JSON.parse(dm_script.textContent || '') as JsonObject;
			}
			// parsing error; log error and skip
			catch(e_parse) {
				error(`JSON parsing error on WHIP-003 script: ${e_parse.stack}`);
				continue;
			}
		}
		// unsupported media type; skip
		else {
			continue;
		}

		// top-level item should be a dict
		if(!is_dict(g_parsed)) {
			error(`Expected top-level WHIP-003 export to be a table`);
			continue;
		}

		// .chains given
		const h_chains = g_parsed.chains as JsonObject;
		ALL_CHAINS:
		if(h_chains) {
			// invalid shape; error and continue
			if(!is_dict(h_chains)) {
				error(`Expected .contracts property on WHIP-003 export to be a table`);
				break ALL_CHAINS;
			}

			// each chain def
			for(const [si_chain, g_chain] of ode(h_chains)) {
				// invalid shape
				if(!is_dict(g_chain)) {
					error(`Expected .chains["${si_chain}"] property on WHIP-003 export to be a table`);
					continue;
				}

				// prep sanitized form
				const g_sanitized = {} as ChainInterface;

				// .namespace property
				{
					// missing
					if(!('namespace' in g_chain)) {
						error(`Missing required .namespace property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// invalid
					if('string' !== typeof g_chain.namespace) {
						error(`Invalid type for required .namespace property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// syntax violation
					if(!RT_CAIP_2_NAMESPACE.test(g_chain.namespace)) {
						error(`Invalid CAIP-2 namespace syntax for required .namespace property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// set property
					g_sanitized.namespace = g_chain.namespace as ChainNamespaceKey;
				}

				// .reference property
				{
					// missing
					if(!('namespace' in g_chain)) {
						error(`Missing required .reference property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// invalid
					if('string' !== typeof g_chain.reference) {
						error(`Invalid type for required .reference property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// syntax violation
					if(!RT_CAIP_2_REFERENCE.test(g_chain.reference)) {
						error(`Invalid CAIP-2 reference syntax for required .reference property at .chains["${si_chain}"] on WHIP-003 export`);
						continue;
					}

					// set property
					g_sanitized.reference = g_chain.reference;
				}
			}
		}

		// .contracts given
		const h_contracts = g_parsed.contracts as JsonObject;
		if(h_contracts) {
			// valid shape
			if(is_dict(h_contracts)) {
				// each contract def
				for(const [si_contract, g_contract] of ode(h_contracts)) {
					// valid shape
					if(is_dict(g_contract)) {
						// prep sanitized form
						const g_sanitized = {} as ContractInterface;

						// missing .chain property
						if(!('chain' in g_contract)) {
							error(`Missing required .contracts["${si_contract}"].chain property on WHIP-003 export`);
							continue;
						}

						// invalid required .chain property type; skip def
						if('string' !== typeof g_contract.chain) {
							error(`Invalid type for required .contracts["${si_contract}"].chain property on WHIP-003 export`);
							continue;
						}

						// parse .chain property
						const m_caip2 = R_CAIP_2.exec(g_contract.chain);

						// invalid syntax for required .chain property; skip def
						if(!m_caip2) {
							error(`Invalid CAIP-2 syntax for required .contracts["${si_contract}"].chain property on WHIP-003 export`);
							continue;
						}

						// set chain property
						g_sanitized.chain = `/family.${m_caip2[1] as ChainNamespaceKey}/chain.${m_caip2[2]}`;


						// missing .address property
						if(!('address' in g_contract)) {
							error(`Missing required .contracts["${si_contract}"].address property on WHIP-003 export`);
							continue;
						}

						// invalid required .address property type; skip def
						if('string' !== typeof g_contract.address) {
							error(`Invalid type for required .contracts["${si_contract}"].address property on WHIP-003 export`);
							continue;
						}

						// parse .address property
						const m_bech32 = R_BECH32.exec(g_contract.address);

						// invalid syntax for required .address property; skip def
						if(!m_bech32) {
							error(`Invalid CAIP-2 syntax for required .contracts["${si_contract}"].address property on WHIP-003 export`);
							continue;
						}

						// set address property
						g_sanitized.bech32 = g_contract.address;

						// copy interfaces
						if('interfaces' in g_contract) {
							const a_interfaces = g_contract.interfaces as TokenSpecKey[];
							if(Array.isArray(a_interfaces)) {
								// prep output
								const a_specs: TokenSpecKey[] = g_sanitized.interfaces = [];

								// create set of unique items
								const as_interfaces = new Set(a_interfaces);

								// check each value
								for(const si_interface of as_interfaces) {
									// not a string, ignore
									if('string' !== typeof si_interface) {
										error(`Ignoring non-string value in .contracts["${si_contract}"].interfaces list on WHIP-003 export: "${si_interface}"`);
										continue;
									}

									// valid, add to list
									a_specs.push(si_interface);
								}
							}
							else {
								error(`Invalid type for optional .contracts["${si_contract}"].interfaces property on WHIP-003 export`);
							}
						}

						// parse optional .label property
						if('label' in g_contract) {
							if('string' === typeof g_contract.label) {
								if(R_CONTRACT_NAME.test(g_contract.label)) {
									g_sanitized.name = g_contract.label;
								}
								else {
									error(`Contract label "${g_contract.label}" violates the regular expression /${R_CONTRACT_NAME.source}/u`);
								}
							}
							else {
								error(`Invalid type for optional .contracts["${si_contract}"].label property on WHIP-003 export`);
							}
						}

						// ref symbol
						let si_symbol = si_contract;

						// symbol doesn't pass regex
						if(!R_TOKEN_SYMBOL.test(si_symbol)) {
							// upper-case version does
							si_symbol = si_symbol.toUpperCase();
							if(R_TOKEN_SYMBOL.test(si_symbol)) {
								debug(`Converted provided "${si_contract}" symbol to "${si_symbol}"`);
							}
							// need to generate one instead
							else {
								error(`Contract symbol "${si_contract}" does not match the acceptable pattern /${R_TOKEN_SYMBOL.source}/u\nA generated symbol will be used instead`);
								si_symbol = await generate_token_symbol(g_sanitized.bech32 as Bech32);
								debug(`Using generated "${si_symbol}" symbol instead of provided "${si_contract}"`);
							}
						}

						// populate contract def symbol
						h_contract_defs[si_symbol] = g_sanitized;
					}
					// invalid, but continue scanning other contract defs
					else {
						error(`Expected .contracts["${si_contract}"] property on WHIP-003 export to be a TOML Table`);
					}
				}
			}
			// invalid, but continue scanning other properties
			else {
				error(`Expected .contracts property on WHIP-003 export to be a TOML Table`);
			}
		}
	}

	// create profile
	const g_profile = {
		name: document.head?.querySelector('meta[name="application-name"]')?.getAttribute('content'),
		pfps: Object.fromEntries(a_res_entries.filter(w => w) as [string, string][]),
		contracts: h_contract_defs,
	};

	// save to session
	await SessionStorage.set({
		[`profile:${location.origin}` as const]: g_profile,
	});

	// return created profile
	return g_profile;
}

// // declare channel message handlers
// export const h_handlers_authed: Vocab.Handlers<RelayToHost.AuthedVocab> = {
// 	// handle connection requests
// 	async requestConnect(g_request) {
// 		void d_runtime.sendMessage({
// 			type: 'requestConnection',
// 			value: {
// 				chains: a_chain_requests,
// 			},
// 		});

// 		// // prep flow result
// 		// let g_result;
// 		// try {
// 		// 	// await flow
// 		// 	g_result = await flow_send({
// 		// 		flow: {
// 		// 			type: 'requestConnection',
// 		// 			value: {
// 		// 				chains: a_requests,
// 		// 			},
// 		// 			page: {
// 		// 				href: location.href,
// 		// 				tabId: -1,
// 		// 			},
// 		// 		},
// 		// 	});
// 		// }
// 		// catch(e_popup) {
// 		// 	// TODO: handle chrome error
// 		// 	// TODO: handle flow error
// 		// 	throw e_popup;
// 		// }

// 		// fetch from store


// 		// // ports
// 		// const a_ports: Array<MessagePort | null> = [];

// 		// // no port
// 		// a_ports.push(null);


// 		// for(const g_chain of a_chains) {
// 		// 	// create channel
// 		// 	const d_channel = new MessageChannel();

// 		// 	// assign port 1
// 		// 	const kc_chain = await HostConnection.create(g_chain, d_channel.port1);

// 		// 	// resoond with port 2
// 		// 	a_ports.push(d_channel.port2);
// 		// }


// 		// d_port.postMessage({
// 		// 	type: 'respondConnect',
// 		// 	value: {
// 		// 		index: i_request,
// 		// 		answer: {
// 		// 			config: {
// 		// 				features: a_features,
// 		// 			},
// 		// 		},
// 		// 	},
// 		// }, a_ports);
// 	},

// 	// handle website error reporting
// 	reportWebsiteError(s_reson: string) {
// 		// TODO: handle
// 	},
// };
