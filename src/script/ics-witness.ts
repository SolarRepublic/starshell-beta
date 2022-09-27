import type {
	IcsToService, IntraExt,
} from './messages';

// inline require types
import type * as UtilBelt from '#/util/belt';
import type * as UtilData from '#/util/data';
import type * as Utils from './utils';
import type * as PublicStorageImport from '#/extension/public-storage';
import type * as VaultImport from '#/crypto/vault';
import type * as ConstantsImport from '#/share/constants';
import type * as IsolatedCoreImport from './isolated-core';

import type * as AppsImport from '#/store/apps';
import type * as AccountsImport from '#/store/accounts';
import type * as ChainsImport from '#/store/chains';
import type * as ContractsImport from '#/store/contracts';
import type * as MetaAppImport from '#/meta/app';
import type * as CosmJsEncodingImpot from '@cosmjs/encoding';
// import type * as CryptoSecretImport from '#/crypto/secret';
import type * as SecretsImport from '#/store/secrets';
import type * as ConsolidatorImport from '#/util/consolidator';
import type * as SessionStorageImport from '#/extension/session-storage';


// import type {Key as KeplrExportedKey} from '@keplr-wallet/types';
import type {KeplrGetKeyWalletCoonectV1Response as KeplrExportedKey} from '@keplr-wallet/wc-client';
import type {Dict, Promisable, JsonObject, JsonValue} from '#/meta/belt';
import type {DirectSignResponse} from '@cosmjs/proto-signing';
import type {AppProfile} from '#/store/apps';

import type {Vocab} from '#/meta/vocab';

import type {AppInterface} from '#/meta/app';
import type {Bech32, Caip2, ChainInterface, ChainPath} from '#/meta/chain';
import type {PfpTarget} from '#/meta/pfp';
import type {SessionRequest} from '#/meta/api';
import type {InternalConnectionsResponse, InternalSessionResponse} from '#/provider/connection';
import type {AccountInterface, AccountPath} from '#/meta/account';
import type {Long} from 'long';
import type {KeplrSignOptions} from '@keplr-wallet/types';
import type {ProxyRequest, ProxyRequestResponse} from '@keplr-wallet/provider';
import type {AdaptedAminoResponse, AdaptedStdSignDoc} from '#/schema/amino';


// amount of time to wait for page to request an advertisement from StarShell before applying keplr polyfill
const XT_POLYFILL_DELAY = 1.5e3;


/**
 * The witness script listens for Keplr requests from the page and forwards them to the service.
 * It will also inspect the page to deduce if it will be using the Keplr API in order to prompt user to enable polyfill.
 * Finally, if the browser is not able to register content scripts and the polyfill is enabled either globally or for
 * this page individually, the witness script will inject the `window.keplr` polyfill object into the page.
 */
(function() {
	// verbose
	const logger = si_channel => (s: string, ...a_args: any[]) => console[si_channel](`StarShell.ics-witness: ${s}`, ...a_args as unknown[]);
	const debug = logger('debug');
	const warn = logger('warn');
	const error = logger('error');
	debug(`Launched on <${location.href}>`);

	// imports
	const {
		NL_DATA_ICON_MAX,
		N_PX_DIM_ICON,
		A_KEPLR_EMBEDDED_CHAINS,
		A_TESTNETS,
		R_CHAIN_ID_VERSION,
		R_CAIP_2,
		R_DATA_IMAGE_URL_WEB: R_DATA_IMAGE_URL,
		G_USERAGENT,
	} = inline_require('#/share/constants.ts') as typeof ConstantsImport;

	const {
		fromBech32,
	} = inline_require('@cosmjs/encoding') as typeof CosmJsEncodingImpot;

	const {
		Vault,
	} = inline_require('#/crypto/vault.ts') as typeof VaultImport;

	const {
		Consolidator,
	} = inline_require('#/util/consolidator.ts') as typeof ConsolidatorImport;

	const {
		SessionStorage,
	} = inline_require('#/extension/session-storage.ts') as typeof SessionStorageImport;

	const {
		microtask,
		timeout,
		fold,
		ode,
		oderom,
		F_NOOP,
	} = inline_require('#/util/belt.ts') as typeof UtilBelt;

	const {
		base93_to_buffer,
		base64_to_buffer,
		buffer_to_base93,
		buffer_to_hex,
		hex_to_buffer,
		serialize_to_json,
	} = inline_require('#/util/data.ts') as typeof UtilData;

	const {
		locate_script,
	} = inline_require('./utils.ts') as typeof Utils;

	const {
		PublicStorage,
	} = inline_require('#/extension/public-storage.ts') as typeof PublicStorageImport;

	const {
		ServiceRouter,
		create_app_profile,
	} = inline_require('./isolated-core.ts') as typeof IsolatedCoreImport;

	const {
		Apps,
	} = inline_require('#/store/apps.ts') as typeof AppsImport;

	const {
		Accounts,
	} = inline_require('#/store/accounts.ts') as typeof AccountsImport;

	const {
		Chains,
	} = inline_require('#/store/chains.ts') as typeof ChainsImport;

	const {
		Contracts,
	} = inline_require('#/store/contracts.ts') as typeof ContractsImport;

	const {
		AppApiMode,
	} = inline_require('#/meta/app.ts') as typeof MetaAppImport;

	type KeplrResponse<w_success extends any=any> = undefined | {
		error: string;
	} | {
		return: w_success;
	};

	type AsyncKeplrResponse<w_success extends any=any> = Promise<KeplrResponse<w_success>>;

	const G_RETURN_VOID = {
		return: void 0,
	};

	const buffer_to_keplr_str = (atu8: Uint8Array) => `__uint8array__${buffer_to_hex(atu8)}`;
	const keplr_str_to_buffer = (sx_str: string) => hex_to_buffer(sx_str.replace(/^__uint8array__/, ''));

	let g_registered_app: AppInterface | null = null;

	const h_keplr_connections: Dict<KeplrChainConnection> = {};

	const token_consolidator = (
		si_type: 'requestAddTokens' | 'requestViewingKeys',
		p_account: AccountPath,
		p_chain: ChainPath
	) => new Consolidator<IcsToService.AppResponse<void>>(async(a_tokens: Bech32[]) => {
		const g_response = await d_runtime_app.sendMessage({
			type: si_type,
			value: {
				accountPath: p_account,
				chainPath: p_chain,
				bech32s: a_tokens,
			},
		});

		if(g_response.error) {
			throw g_response.error;
		}
		else {
			return fold(a_tokens, (sa_token) => {
				const w_each = g_response.ok![sa_token];
				if(w_each.error) {
					return {
						[sa_token]: w_each,
					};
				}
				else {
					return {
						[sa_token]: {
							return: w_each.ok,
						},
					};
				}
			});
		}
	});

	class KeplrChainConnection {
		protected _g_account: AccountInterface;
		protected _g_chain: ChainInterface;
		protected _g_permissions: Partial<MetaAppImport.AppPermissionSet>;
		protected _p_account: AccountPath;
		protected _p_chain: ChainPath;
		protected _sa_owner: Bech32;

		protected _kc_add_tokens: Consolidator<IcsToService.AppResponse<void>>;
		protected _kc_viewing_keys: Consolidator<IcsToService.AppResponse<void>>;

		constructor(protected _g_session: InternalSessionResponse, protected _ks_accounts: Awaited<ReturnType<typeof Accounts.read>>) {
			const {
				chain: g_chain,
				accounts: a_accounts,
				permissions: g_permissions,
			} = _g_session;

			this._g_chain = g_chain;
			this._g_permissions = g_permissions;

			const p_account = this._p_account = a_accounts[0];

			// only one account can be used at a time in Keplr mode
			const g_account = this._g_account = _ks_accounts.at(p_account)!;

			this._sa_owner = Chains.addressFor(g_account.pubkey, g_chain);

			const p_chain = this._p_chain = Chains.pathFrom(g_chain);

			this._kc_add_tokens = token_consolidator('requestAddTokens', p_account, p_chain);
			this._kc_viewing_keys = token_consolidator('requestViewingKeys', p_account, p_chain);
		}

		get accountPath(): AccountPath {
			return this._p_account;
		}

		get account(): AccountInterface {
			return this._g_account;
		}

		get address(): Bech32 {
			return this._sa_owner;
		}

		getKey(): KeplrExportedKey & {intercepts?: string[]} {
			const {
				_g_permissions,
				_g_account,
				_g_chain,
			} = this;

			const atu8_pubkey = base64_to_buffer(_g_account.pubkey);
			const sa_owner = Chains.addressFor(_g_account.pubkey, _g_chain);  // TODO: bech32 type depending on session request

			// structure object in same order as Keplr (which alphabetizes it)
			return {
				address: buffer_to_keplr_str(fromBech32(sa_owner).data),
				algo: 'secp256k1',
				bech32Address: sa_owner,
				isNanoLedger: false,
				name: _g_permissions.doxx?.name? _g_account?.name: 'beta',  // TODO: fill with random name?
				pubKey: buffer_to_keplr_str(atu8_pubkey),
				// intercepts: ['address', 'bech32Address', 'pubbKey'],
			};
		}

		suggestToken(sa_token: Bech32) {
			return this._kc_add_tokens.queue(sa_token);
		}

		viewingKey(sa_token: Bech32) {
			return this._kc_viewing_keys.queue(sa_token);
		}
	}



	// ref and cast browser runtime
	const d_runtime: Vocab.TypedRuntime<IcsToService.PublicVocab> = chrome.runtime;
	const d_runtime_app: Vocab.TypedRuntime<IcsToService.AppVocab> = chrome.runtime;

	// browser cannot (un)register content scripts dynamically
	if('safari' === __SI_ENGINE) {
		// Keplr compatibility mode is globally disabled; exit
		if(SessionStorage.synchronously?.get('keplr_compatibility_mode_disabled')) {
			warn('Shutdown due to being globally disabled');
			return;
		}
	}

	// profile for the app
	let g_profile: AppProfile | null = null;

	// scope the bulk chain request singleton
	const add_chain_req = (() => {
		// amount of time to wait before sending bulk keys request
		const XT_ACCUMULATE_KEYS_DELAY = 25;

		// max amount of time to wait before forcing bulk request
		const XT_ACCUMULATE_MAX = 250;

		// dict of chains from Keplr with exact id matches
		const H_CHAINS_KEPLR_EXACT = fold(A_KEPLR_EMBEDDED_CHAINS, g_chain => ({
			[g_chain.chainId]: g_chain,
		}));

		// dict of chains from Keplr with same core chain id (without version)
		const H_CHAINS_KEPLR_INEXACT = fold(A_KEPLR_EMBEDDED_CHAINS, (g_chain) => {
			// parse chain id & version
			const m_chain_version = R_CHAIN_ID_VERSION.exec(g_chain.chainId);

			// key by core chain id without version suffix
			if(m_chain_version) {
				return {
					[m_chain_version[1]]: g_chain,
				};
			}

			// do not produce entry for unversioned chain id
			return {};
		});

		// set of chains to request in bulk
		const as_chains = new Set<string>();

		// queue pending callbacks
		const h_pending: Record<Caip2.String, Array<(k_connection: KeplrChainConnection) => void>> = {};

		// 
		let xt_bulk_req = 0;
		let i_bulk_req = 0;

		async function send_bulk_req() {
			// clear timeout
			clearTimeout(i_bulk_req);
			i_bulk_req = 0;

			// convert set to list
			const a_chains = [...as_chains];

			// clear the set for next bulk operation
			as_chains.clear();

			// preapproved Keplr chains
			const a_chains_keplr: string[] = [];

			// collect chain version mismatches
			const a_chains_inexact: {
				requested: string;
				known: string;
			}[] = [];

			// others
			const a_chains_other: string[] = [];

			// invalid
			const a_chains_invalid: string[] = [];

			// sort chains
			for(const si_chain of a_chains) {
				// exact chain id match from Keplr
				if(H_CHAINS_KEPLR_EXACT[si_chain]) {
					a_chains_keplr.push(si_chain);
					continue;
				}

				// versioned chain id
				const m_chain_version = R_CHAIN_ID_VERSION.exec(si_chain);
				if(m_chain_version) {
					// destructure chain core id and version
					const [, si_chain_core, s_version] = m_chain_version;

					// match found in Keplr's list
					const g_chain_inexact = H_CHAINS_KEPLR_INEXACT[si_chain_core];
					if(g_chain_inexact) {
						// log version difference
						a_chains_inexact.push({
							requested: si_chain,
							known: g_chain_inexact.chainId,
						});

						continue;
					}
				}

				// valid CAIP-2; push to others
				const m_caip2 = R_CAIP_2.exec(`cosmos:${si_chain}`);
				if(m_caip2) {
					a_chains_other.push(si_chain);
					continue;
				}

				// invalid
				a_chains_invalid.push(si_chain);
			}

			// log invalid chains
			if(a_chains_invalid.length) {
				error('The following chain IDs are considered invalid: %o', a_chains_invalid);
			}

			// convert Keplr chains to StarShell format
			const h_chains = fold(a_chains_keplr, (si_chain): Record<Caip2.String, ChainInterface> => {
				// ref chain def from Keplr's export
				const g_chain_keplr = H_CHAINS_KEPLR_EXACT[si_chain];

				// ref bech32 config
				const gc_bech32 = g_chain_keplr.bech32Config;

				// prep CAIP-2 identifier
				const si_caip2 = `cosmos:${si_chain}` as const;

				// StarShell format
				return {
					[si_caip2]: {
						// all chains imported from Keplr are in the cosmos namespace
						namespace: 'cosmos',

						// chain id becomes the CAIP-2 reference identifier
						reference: si_chain,

						// testnet
						...g_chain_keplr.beta && {
							testnet: true,
						},

						// human parts
						name: g_chain_keplr.chainName,
						pfp: '' as PfpTarget,

						// dict of "built-in" coins for chain
						coins: fold(g_chain_keplr.currencies, g_coin => ({
							[g_coin.coinDenom]: {
								name: g_coin.coinDenom,
								denom: g_coin.coinMinimalDenom,
								decimals: g_coin.coinDecimals,
								pfp: '' as PfpTarget,
								extra: {
									...g_coin['coinGeckoId'] && {
										coingecko_id: g_coin['coinGeckoId'],
									},
								},
							},
						})),

						// transform fee and stake currencies to coin identifiers
						feeCoinIds: g_chain_keplr.feeCurrencies.map(g => g.coinDenom),
						stakeCoinIds: [g_chain_keplr.stakeCurrency.coinDenom],

						// adapt bip44 to slip44s
						slip44s: [
							{
								coinType: g_chain_keplr.bip44.coinType || g_chain_keplr.coinType || 118,
							},
							...g_chain_keplr.alternativeBIP44s || [],
						],

						// convert Keplr's bech32 config to StarShell's more agnostic format
						bech32s: {
							acc: gc_bech32.bech32PrefixAccAddr,
							accpub: gc_bech32.bech32PrefixAccPub,
							valoper: gc_bech32.bech32PrefixValAddr,
							valoperpub: gc_bech32.bech32PrefixValPub,
							valcons: gc_bech32.bech32PrefixConsAddr,
							valconspub: gc_bech32.bech32PrefixConsPub,
						},

						// TODO: define mapping from Keplr `features` to interfaces
						tokenInterfaces: [],

						// use mintscan by default
						blockExplorer: {
							base: 'https://mintscan.io/{chain_prefix}',
							block: '/blocks/{height}',
							account: '/account/{address}',
							contract: '/account/{address}',
							validator: '/validators/{address}',
							transaction: '/txs/{hash}',
						},
					},
				};
			});

			// send message to service
			const h_responses = await ServiceRouter.connect({
				schema: '1',
				chains: h_chains,
				sessions: oderom(h_chains, (si_caip2: Caip2.String): Dict<SessionRequest> => ({
					[si_caip2]: {
						caip2: si_caip2,
						query: {},
						broadcast: {},
						doxx: {
							name: true,
							address: {
								justification: '',
							},
						},
					},
				})),
			}) as InternalConnectionsResponse;

			if(h_responses) {
				// read from accounts store
				const ks_accounts = await Accounts.read();

				// 1:1 chain session request
				for(const [p_chain, g_session] of ode(h_responses)) {
					const k_connection = new KeplrChainConnection(g_session, ks_accounts);

					const si_chain = g_session.chain.reference;

					h_keplr_connections[si_chain] = k_connection;

					// callback each pending promise with exported keys
					h_pending[si_chain].forEach(f => f(k_connection));
				}
			}
		}

		// iiaf result
		return function(si_chain: string): Promise<KeplrChainConnection> {
			// go async
			return new Promise((fk_resolve) => {
				// chain not "recognized" by Keplr's default (nor our testnets)
				if(!A_TESTNETS.filter(g => si_chain === g.chainId).length && !A_KEPLR_EMBEDDED_CHAINS.filter(g => si_chain === g.chainId).length) {
					return {
						error: `There is no chain info for ${si_chain}`,
					};
				}

				// add chain to outgoing set
				as_chains.add(si_chain);

				// add callback
				(h_pending[si_chain] = h_pending[si_chain] || []).push((k_connection: KeplrChainConnection) => {
					fk_resolve(k_connection);
				});

				// accumulation time maxed out
				if(i_bulk_req && Date.now() - xt_bulk_req > XT_ACCUMULATE_MAX) {
					warn('Accumulation time maxed out');
					void send_bulk_req();

					// do not add it again
					return;
				}

				// no accumulator yet; set start time
				if(!i_bulk_req) {
					xt_bulk_req = Date.now();
				}

				// create or extend timeout
				clearTimeout(i_bulk_req);
				i_bulk_req = window.setTimeout(send_bulk_req, XT_ACCUMULATE_KEYS_DELAY);
			});
		};
	})();



	/* eslint-disable @typescript-eslint/no-throw-literal,no-throw-literal */
	function check_chain(si_chain: string): KeplrChainConnection {
		// chain is not registered
		if(!h_keplr_connections[si_chain]) {
			warn(`The developer of the app running on ${location.origin} did not bother calling \`window.keplr.enable()\` before attempting to use the API. Rejecting the request.`);

			// developer did not request to enable chain first, reject the request on behalf of the user
			throw 'Request rejected';

			// // app did not request it first, but keplr still counts it as a request
			// const g_enable = await h_handlers_keplr.enable([si_chain]);

			// // there was an error, exit
			// if(g_enable) {
			// 	return g_enable;
			// }

			// // otherwise, retry
			// return h_handlers_keplr.getKey(a_args);
		}

		// lookup connection
		const k_connection = h_keplr_connections[si_chain];

		// connection does not exist
		if(!k_connection) throw 'Request rejected';

		// return connection
		return k_connection;
	}

	function app_to_keplr<w_out extends any>(
		g_response: IcsToService.AppResponse<JsonValue>,
		f_transform=(w_in: any): w_out => w_in
	): KeplrResponse<w_out> {
		if(g_response?.error) {
			throw g_response.error;
		}
		else if(g_response?.ok) {
			return {
				return: f_transform(g_response.ok),
			};
		}
	}

	const h_handlers_keplr: Record<string, (a_args: unknown[]) => Promisable<KeplrResponse>> = {
		async enable(a_args): Promise<KeplrResponse<undefined>> {
			const z_arg_0 = a_args[0];

			// emulate Keplr's response
			if(!z_arg_0) throw 'chain id not set';

			// validate string
			if('string' === typeof z_arg_0) {
				await add_chain_req(z_arg_0);
			}
			// validate array
			else if(Array.isArray(z_arg_0)) {
				// each item in list
				for(const z_test of z_arg_0) {
					if('string' === typeof z_test) {
						await add_chain_req(z_test);
					}
					else {
						// emulate exact same error keplr would throw
						const e = z_test;
						try {
							e.split(/(.+)-([\d]+)/);
						}
						catch(e_runtime) {
							return {
								error: e_runtime.message,
							};
						}
					}
				}
			}
			// other type; emulate Keplr's response
			else {
				throw 't is not iterable';
			}

			// succeed
			return G_RETURN_VOID;
		},

		getKey(a_args): KeplrResponse<KeplrExportedKey> {
			// emulate Keplr's response (yes, it includes the "parmas" typo!)
			if(1 !== a_args.length) throw 'Invalid parmas';

			// ref arg 0
			const si_chain = a_args[0];

			// invalid param; emulate Keplr's response (yes, it includes the "parmas" typo!)
			if(!si_chain || 'string' !== typeof si_chain) throw 'Invalid parmas';

			// ensure the chain was enabled first
			const k_connection = check_chain(si_chain);

			// succeed
			return {
				return: k_connection.getKey(),
			};
		},

		async signAmino(a_args): AsyncKeplrResponse<AdaptedAminoResponse> {
			const [si_chain, sa_signer, g_doc] = a_args as [string, string, AdaptedStdSignDoc];

			const gc_sign = a_args[3] as KeplrSignOptions;

			if(!si_chain) throw 'chain id not set';

			if(!sa_signer) throw 'signer not set';

			if(g_doc.chain_id !== si_chain) throw 'Chain id in the message is not matched with the requested chain id';

			// ensure the chain was enabled first
			const k_connection = check_chain(si_chain);

			// wrong signer, reject emulating Keplr's response
			if(sa_signer !== k_connection.address) throw 'Signer mismatched';

			// serialize the signDoc
			const g_doc_serialized = serialize_to_json(g_doc);

			debug(`Submitting cosmos amino signature request: ${JSON.stringify(g_doc_serialized)}`);

			// request signature
			const g_response = await d_runtime_app.sendMessage({
				type: 'requestCosmosSignatureAmino',
				value: {
					accountPath: k_connection.accountPath,
					chainPath: Chains.pathFor('cosmos', si_chain),
					doc: g_doc_serialized,
				},
			});

			debug(`Received cosmos amino signature response: ${JSON.stringify(g_response?.ok)}`);

			return app_to_keplr(g_response);
		},

		async signDirect(a_args): AsyncKeplrResponse<DirectSignResponse> {
			const [si_chain, sa_signer, g_doc] = a_args as [string, string, {
				bodyBytes?: Uint8Array | null;
				authInfoBytes?: Uint8Array | null;
				chainId?: string | null;
				accountNumber?: Long | null;
			}];

			const gc_sign = a_args[3] as KeplrSignOptions;

			if(!si_chain) throw 'chain id not set';

			if(!sa_signer) throw 'signer not set';

			if(g_doc.chainId !== si_chain) throw 'Chain id in the message is not matched with the requested chain id';

			// ensure the chain was enabled first
			const k_connection = check_chain(si_chain);

			// wrong signer, reject emulating Keplr's response
			if(sa_signer !== k_connection.address) throw 'Signer mismatched';

			// serialize the signDoc
			const g_doc_serialized = serialize_to_json({
				...g_doc,
				chainId: si_chain,
				accountNumber: g_doc.accountNumber? g_doc.accountNumber+'': void 0,
			});

			// request the actual signing
			await d_runtime_app.sendMessage({
				type: 'requestCosmosSignatureDirect',
				value: {
					accountPath: k_connection.accountPath,
					chainPath: Chains.pathFor('cosmos', si_chain),
					doc: g_doc_serialized,
				},
			});
		},

		async experimentalSuggestChain(a_args): AsyncKeplrResponse<void> {
			const [g_suggest] = a_args;

			const si_chain = g_suggest?.chainId;
			if('string' === typeof si_chain) {
				const p_chain = Chains.pathFor('cosmos', si_chain);

				const g_chain = await Chains.at(p_chain);

				if(g_chain) {
					return G_RETURN_VOID;
				}

				// let service handle denying it
				void add_chain_req(si_chain);
			}

			throw `Refusing chain suggestion "${si_chain}" in StarShell beta`;
		},

		async suggestToken(a_args): AsyncKeplrResponse<void> {
			const [si_chain, sa_contract] = a_args as [string, Bech32];

			// validate message format
			if('string' !== typeof si_chain || 'string' !== typeof sa_contract) {
				throw 'Invalid request';
			}

			// ensure the chain was enabled first
			const k_connection = check_chain(si_chain);

			// check that chain exists
			const p_chain = Chains.pathFor('cosmos', si_chain);
			const g_chain = await Chains.at(p_chain);
			if(!g_chain) throw `Refusing token suggestion for unknown chain "${si_chain}"`;

			// contract already exists
			const p_contract = Contracts.pathOn('cosmos', si_chain, sa_contract);
			const g_contract = await Contracts.at(p_contract);
			if(g_contract) return G_RETURN_VOID;

			// suggest token
			const g_suggest = await k_connection.suggestToken(sa_contract);

			return app_to_keplr(g_suggest);
		},

		async getSecret20ViewingKey(a_args): AsyncKeplrResponse<string> {
			const [si_chain, sa_contract] = a_args as [string, Bech32];

			// validate message format
			if('string' !== typeof si_chain || 'string' !== typeof sa_contract) {
				throw 'Invalid request';
			}

			// ensure the chain was enabled first
			const k_connection = check_chain(si_chain);

			// check that chain exists
			const p_chain = Chains.pathFor('cosmos', si_chain);
			const g_chain = await Chains.at(p_chain);
			if(!g_chain) throw `Refusing token suggestion for unknown chain "${si_chain}"`;

			// contract does not exist
			const p_contract = Contracts.pathOn('cosmos', si_chain, sa_contract);
			const g_contract = await Contracts.at(p_contract);
			if(!g_contract) {
				warn(`User has no viewing keys set for ${sa_contract}`);
				throw 'Request rejected';
			}

			const g_key = await k_connection.viewingKey(sa_contract);

			return app_to_keplr(g_key);
		},

		async enigmaEncrypt(a_args): AsyncKeplrResponse<string> {
			const [si_chain, s_code_hash, h_exec] = a_args as [string, string, JsonObject];

			// ensure the chain was enabled first
			const k_connection = check_chain(si_chain);

			// check that chain exists
			const p_chain = Chains.pathFor('cosmos', si_chain);
			const g_chain = await Chains.at(p_chain);
			if(!g_chain) throw `Refusing encryption request for unknown chain "${si_chain}"`;

			// chain is secretwasm compatible
			if(!g_chain?.features.secretwasm) {
				throw `Refusing encryption request for non-secretwasm compatible chain "${si_chain}"`;
			}

			// ask service to encrypt
			const g_encrypt = await d_runtime_app.sendMessage({
				type: 'requestEncrypt',
				value: {
					accountPath: k_connection.accountPath,
					chainPath: Chains.pathFor('cosmos', si_chain),
					codeHash: s_code_hash,
					exec: h_exec,
				},
			});

			return app_to_keplr(g_encrypt, sxb93 => buffer_to_keplr_str(base93_to_buffer(sxb93)));
		},

		async enigmaDecrypt(a_args): AsyncKeplrResponse<string> {
			const [si_chain, sx_ciphertext, sx_nonce] = a_args as [string, string, string];

			// ensure the chain was enabled first
			const k_connection = check_chain(si_chain);

			// lookup chain
			const g_chain = await Chains.at(Chains.pathFor('cosmos', si_chain));

			// chain is secretwasm compatible
			if(g_chain?.features.secretwasm) {
				// ask service to dcrypt
				const g_decrypt = await d_runtime_app.sendMessage({
					type: 'requestDecrypt',
					value: {
						accountPath: k_connection.accountPath,
						chainPath: Chains.pathFor('cosmos', si_chain),
						ciphertext: buffer_to_base93(keplr_str_to_buffer(sx_ciphertext)),
						nonce: buffer_to_base93(keplr_str_to_buffer(sx_nonce)),
					},
				});

				return app_to_keplr(g_decrypt, sxb93 => buffer_to_keplr_str(base93_to_buffer(sxb93)));
			}
		},
	};
	/* eslint-enable */

	// whether to cancel polyfill after the witness has loaded
	let b_cancel_polyfill = false;

	// time at which keplr polyfill was initialized
	let xt_polyfill_init = 0;

	// prep handler map
	const h_handlers_window = {
		// app is capable of connecting to StarShell without Keplr polyfill
		requestAdvertisement() {
			// cancel polyfill
			b_cancel_polyfill = true;
		},

		// request to keplr
		async 'proxy-request'(g_data: ProxyRequest) {
			// minimum init time has not yet elapsed; wait it out
			const xt_elapsed = Date.now() - xt_polyfill_init;
			if(xt_elapsed < XT_POLYFILL_DELAY) {
				await timeout(XT_POLYFILL_DELAY - xt_elapsed);
			}

			// polyfill disabled
			if(b_cancel_polyfill) return;

			// app profile has not been made
			if(!g_profile) {
				g_profile = await create_app_profile();
			}

			// destructure data
			const {
				args: a_args,
				id: si_request,
				method: si_method,
			} = g_data;

			// lookup method
			const f_keplr = h_handlers_keplr[si_method];

			// route exists
			if(f_keplr) {
				debug(`Routing Keplr request for '${si_method}': %o`, g_data);
				// invoke method asynchronously
				let w_result: KeplrResponse;
				try {
					w_result = await f_keplr(a_args);
				}
				catch(e_call) {
					w_result = {
						error: (e_call instanceof Error? e_call.message || e_call: e_call)+'',
					};
				}

				// polyfill disabled
				if(b_cancel_polyfill) return;

				// method returned a result or threw an error
				if(w_result) {
					// type-check response
					const g_response: ProxyRequestResponse = {
						id: si_request,
						result: w_result,
						type: 'proxy-request-response',
					};

					if(w_result['error']) {
						warn(`Responding to Keplr '${si_method}' request with error %o`, w_result['error']);
					}
					else {
						debug(`Responding to Keplr '${si_method}' request with result %o`, w_result);
					}

					// respond
					window.postMessage(g_response);
				}
				// otherwise, ignore
				else {
					warn(`Ignoring proxy-request for %o`, g_data);
				}
			}
			// no route exists
			else {
				warn(`Unrouted Keplr proxy request: ${si_method}: %o`, g_data);
			}
		},
	};

	let b_polyfill_executed = false;

	async function inject_keplr_polyfill() {
		// polyfill was cancelled or already executed
		if(b_cancel_polyfill || b_polyfill_executed) return;

		// notify
		debug('Injecting Keplr API polyfill');

		// polyfill was executed
		b_polyfill_executed = true;

		// create another script element to load the relay application
		const dm_script = document.createElement('script');

		// locate keplr script
		const p_keplr = locate_script('assets/src/script/mcs-keplr');

		// not found
		if(!p_keplr) {
			throw new Error('Unable to locate Keplr script!');
		}

		// set the script src
		dm_script.src = chrome.runtime.getURL(p_keplr);

		// import as module
		dm_script.type = 'module';

		// wait for head/body to be constructed
		let c_retries = 0;
		while(!document.body) {
			warn('document.body not ready');
			c_retries++;
			await timeout(0);
			if(c_retries > 1000) {
				throw new Error(`Failed to read from document.body`);
			}
		}

		// set initialization time
		xt_polyfill_init = Date.now();

		// append container element to the live document to initialize iframe's content document
		try {
			document.head.append(dm_script);
		}
		// browser didn't like adding content to head; fallback to using body
		catch(e_append) {
			document.body.append(dm_script);
		}

		// hide element
		await microtask();
		dm_script.remove();
	}


	(async function keplr_compatibility() {
		// synchronous session storage is available
		if(SessionStorage.synchronously) {
			// unconditional polyfill of keplr is enabled; polyfill immediately
			if(SessionStorage.synchronously.get('keplr_polyfill_mode_enabled')) {
				return void inject_keplr_polyfill();
			}
		}
		// must check setting asynchronously
		else {
			void SessionStorage.get('keplr_polyfill_mode_enabled').then((b_unconditional: boolean) => {
				// polyfill is unconditional; polyfill immediately
				if(b_unconditional) return void inject_keplr_polyfill();
			});
		}

		// wallet is unlocked
		if(await Vault.isUnlocked()) {
			// find matching app
			const a_apps = await Apps.filter({
				scheme: location.protocol.replace(/:$/, '') as 'https',
				host: location.host,
			});

			console.log({a_apps});

			// app is already registered
			if(a_apps.length) {
				// ref app
				const g_app = a_apps[0];

				// app is enabled
				if(g_app.on) {
					// ref api mode
					const xc_api = g_app.api;

					// Keplr API mode is enabled; cancel detection
					if(AppApiMode.KEPLR === xc_api) {
						g_registered_app = g_app;
						debug(`Exitting detection mode since app is already registered: %o`, g_registered_app);

						// force mcs injection enabled; inject keplr
						if(await PublicStorage.forceMcsInjection()) {
							await inject_keplr_polyfill();
						}

						return;
					}
					// another API mode is enabled
					else if(AppApiMode.UNKNOWN !== xc_api) {
						b_cancel_polyfill = true;
						debug(`Cancelling polyfill since app is in alternate mode: %o`, g_app);
						return;
					}
				}
				// app is disabled
				else {
					b_cancel_polyfill = true;
					debug(`Cancelling polyfill since app is disabled`);
					return;
				}
			}
		}

		// attempt to detect keplr
		DETECT_KEPLR: {
			// fetch Keplr automatic detection setting
			const b_detect_mode = await PublicStorage.keplrDetectionMode();

			// detection is disabled; exit
			if(!b_detect_mode) return;

			// document not yet loaded
			if('complete' !== document.readyState) {
				await new Promise((fk_resolve) => {
					window.addEventListener('DOMContentLoaded', () => {
						fk_resolve(void 0);
					});
				});
			}

			// polyfill has been disabled
			if(b_cancel_polyfill) break DETECT_KEPLR;

			debug('Attempting to detect Keplr');

			// attempt to find usage (0-1 confidence)
			let x_detected = 0;

			// search all scripts
			for(const dm_script of document.getElementsByTagName('script')) {
				// only javascript
				const s_type = dm_script.getAttribute('type');
				if(!s_type || /javascript|^module$/.test(s_type)) {
					// read script string
					let sx_content = dm_script.textContent;

					// no inline script
					if(!sx_content) {
						// src attribute
						const sr_src = dm_script.getAttribute('src');

						// no src either; skip
						if(!sr_src) continue;

						// parse url
						const du_src = new URL(sr_src, location.href);

						// prep response
						let d_res: Response;

						// request
						FETCHING: {
							// same origin
							if(du_src.origin === location.origin) {
								// use cache optimization
								try {
									d_res = await fetch(du_src.href, {
										method: 'GET',
										credentials: 'include',
										mode: 'same-origin',
										redirect: 'follow',
										cache: 'only-if-cached',
									});
								}
								catch(e_fetch) {
									// firefox content script requests initiate from different context
									if('Firefox' === G_USERAGENT.browser.name) {
										// retry without cache
										try {
											d_res = await fetch(du_src.href, {
												method: 'GET',
												credentials: 'include',
												mode: 'same-origin',
												redirect: 'follow',
											});

											// do not err
											break FETCHING;
										}
										// catch error and replace
										catch(e_retry) {
											e_fetch = e_retry;
										}
									}

									debugger;
									error(e_fetch);
									continue;
								}
							}
							// different origin
							else {
								// ignore
								continue;

								// // fallback to cors mode
								// try {
								// 	d_res = await fetch(p_src, {
								// 		method: 'GET',
								// 		credentials: 'include',
								// 		mode: 'cors',
								// 	});
								// }
								// catch(e_fetch) {
								// 	debugger;
								// 	console.error(e_fetch);
								// 	continue;
								// }
							}
						}

						// response not ok; skip it
						if(!d_res?.ok) continue;

						// load script content as string
						sx_content = await d_res.text();
					}

					// find target string
					const b_keplr_window = /window(\.keplr|\[['"`]keplr['"`]\])/.test(sx_content);

					// found
					if(b_keplr_window) {
						x_detected = 1;
						break;
					}

					// try not to block the thread
					await timeout(0);
				}
			}

			// detected
			if(x_detected) {
				debug('Keplr was detected!');

				// start initialization timer
				xt_polyfill_init = Date.now();

				// attempt to create app's profile
				if(!g_profile) {
					try {
						debug(`Creating app profile...`);
						g_profile = await create_app_profile();
					}
					catch(e_create) {}
				}

				// give the script a chance to request advertisement
				await timeout(Math.max(0.5e3, XT_POLYFILL_DELAY - (Date.now() - xt_polyfill_init)));

				// polyfill has been disabled
				if(b_cancel_polyfill) break DETECT_KEPLR;

				// notify service
				d_runtime.sendMessage({
					type: 'detectedKeplr',
					value: {
						profile: g_profile || {},
					},
				}, F_NOOP);
			}
			else {
				debug('Keplr was not detected');
			}
		}
	})();


	// start listening for messages
	window.addEventListener('message', (d_event) => {
		// // verbose
		// debug('Observed window message %o', d_event);

		// originates from same frame
		if(window === d_event.source) {
			// access event data
			const z_data = d_event.data;

			// data item conforms
			let si_type;
			if(z_data && 'object' === typeof z_data && 'string' === typeof (si_type=z_data.type)) {
				// ref handler
				const f_handler = h_handlers_window[si_type];

				// ignore all other messages
				if(!f_handler) return;

				// debug(`Received relay port message having registered type %o`, z_data);

				// handler is registered; execute it
				f_handler(z_data);
			}
		}
	});
})();
