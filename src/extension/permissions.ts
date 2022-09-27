import type {SessionRequest} from '#/meta/api';
import type {Dict} from '#/meta/belt';
import {ode} from '#/util/belt';
import type {Caip2, ChainInterface, ChainPath} from '#/meta/chain';
import {Chains} from '#/store/chains';
import {Accounts} from '#/store/accounts';
import type { AppChainConnection } from '#/meta/app';
import type { AccountInterface, AccountPath } from '#/meta/account';

export interface PermissionsRegistry {
	doxx_name: true;
	dox_address: string[];
	query_node: string[];
	query: true;
	broadcast: true;
}

export interface PermissionsRequestBlock {
	a_account_paths: AccountPath[];
	h_chains: Record<Caip2.String, ChainInterface>;
	h_sessions: Dict<SessionRequest>;
	h_flattened?: Partial<PermissionsRegistry>;
	h_connections?: Record<ChainPath, AppChainConnection>;
	g_set?: AppChainConnection['permissions'];
}

/**
 * The entire request object is already validated and sanitized in content script before it gets here.
 * The purpose of this function is to distill the requests into a workable format.
 */
export function process_permissions_request(g_request: PermissionsRequestBlock): Required<PermissionsRequestBlock> {
	const {
		a_account_paths,
		h_chains,
		h_sessions,
		h_flattened={},
		h_connections={},
		g_set={},
	} = g_request;

	let b_doxx_address = false;
	const as_justify_doxx = new Set<string>();
	let b_query_node = false;
	const as_justify_node = new Set<string>();

	// check each session request
	for(const [, g_session] of ode(h_sessions)) {
		// doxx
		const g_doxx = g_session.doxx;
		if(g_doxx) {
			// requesting name
			if(g_doxx.name) {
				h_flattened.doxx_name = true;
			}

			// requesting address
			if('string' === typeof g_doxx.address?.justification) {
				b_doxx_address = true;
				const s_justification = g_doxx.address.justification.trim();
				if(s_justification) {
					as_justify_doxx.add(s_justification);
				}
			}
		}

		// query
		const g_query = g_session.query;
		if(g_query) {
			// requesting query
			h_flattened.query = true;

			// requesting node
			if('string' === typeof g_query.node?.justification) {
				b_query_node = true;
				const s_justification = g_query.node.justification.trim();
				if(s_justification) {
					as_justify_node.add(s_justification);
				}
			}
		}

		// broadcast
		const g_broadcast = g_session.broadcast;
		if(g_broadcast) {
			h_flattened.broadcast = true;
		}

		// add chain connection
		const g_chain = h_chains[g_session.caip2];
		const p_chain = Chains.pathFrom(g_chain);
		h_connections[p_chain] = {
			accounts: a_account_paths,
			permissions: g_set,
		};
	}

	// doxx address permission is present; coalesce the justifications
	if(b_doxx_address) h_flattened.dox_address = [...as_justify_doxx];

	// query node permission is present; coalesce the justifications
	if(b_query_node) h_flattened.query_node = [...as_justify_node];

	return {
		a_account_paths: a_account_paths,
		h_chains,
		h_sessions,
		h_flattened,
		h_connections,
		g_set,
	};
}



// // each session request
// for(const [, g_session] of ode(g_msg.sessions)) {
// 	// ref CAIP-2
// 	const si_caip2 = g_session.caip2;

// 	// invalid or undefined chain; cancel preapproval
// 	const g_chain_def = h_chains[si_caip2];
// 	if(!g_chain_def?.namespace || !g_chain_def?.reference) break PREAPPROVE_REQUEST;

// 	// lookup chain
// 	const p_chain = Chains.pathFor(g_chain_def.namespace, g_chain_def.reference);
// 	const g_chain = ks_chains.at(p_chain);

// 	// chain does not exist; cancel preapproval
// 	if(!g_chain) break PREAPPROVE_REQUEST;

// 	// connection
// 	const g_connection = h_connections[p_chain];

// 	// 
// 	if(!is_dict(g_session.broadcast) || !g_connection.permissions.broadcast) {
// 		break PREAPPROVE_REQUEST;
// 	}

// 	// ref permissinos
// 	const g_permissions = g_connection.permissions;

// 	// requesting doxx
// 	const g_doxx = g_session.doxx;
// 	if(g_doxx) {
// 		if(!is_dict(g_doxx)) break PREAPPROVE_REQUEST;
// 		if(!g_permissions.doxx) break PREAPPROVE_REQUEST;

// 		// requesting dox.address
// 		if(g_doxx.address) {
// 			if(!is_dict(g_doxx.address) || 'string' !== typeof g_doxx.address.justification
// 				|| !g_permissions.doxx?.address) break PREAPPROVE_REQUEST;
// 		}

// 		// requesting doxx.name
// 		if(g_doxx.name) {
// 			if('string' !== typeof g_doxx.name || !g_permissions.doxx.name) {
// 				break PREAPPROVE_REQUEST;
// 			}
// 		}
// 	}

// 	// requesting query
// 	const g_query = g_session.query;
// 	if(g_query) {
// 		if(!is_dict(g_query)) break PREAPPROVE_REQUEST;
// 		if(!g_permissions.query) break PREAPPROVE_REQUEST;

// 		// requesting query.node
// 		if(g_query.node) {
// 			if(!is_dict(g_query.node) || 'string' !== typeof g_query.node.justification
// 				|| !g_permissions.query.node) break PREAPPROVE_REQUEST;
// 		}

// 		// TODO: check all other query permissions
// 	}
// }
