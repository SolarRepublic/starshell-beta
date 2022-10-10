import type {App} from '#/meta/app';

import {
	create_store_class,
	WritableStore,
} from './_base';

import {SI_STORE_APP_POLICIES} from '#/share/constants';
import {escape_regex} from '#/util/belt';

export class PolicyExistsError extends Error {}

export type AppPolicy = {
	action: 'block' | 'trust';
	matches: string;
	except: string;
};

export type AppPolicyResult = {
	blocked: true;
	trusted: false;
} | {
	blocked: false;

	/**
	 * Indicates that user approval is not needed
	 */
	trusted: boolean;
};

const G_APP_POLICY_RESULT_BLOCKED: AppPolicyResult = {
	blocked: true,
	trusted: false,
};


function policy_applies(g_policy: AppPolicy, g_app: AppInterface): boolean {
	// compile match pattern
	let r_matches: RegExp;
	try {
		r_matches = new RegExp(g_policy.matches);
	}
	// failed to parse policy
	catch(e_parse) {
		console.error(`Failed to parse policy match pattern "${g_policy.matches}"`);
		return false;
	}

	// policy applies
	if(r_matches.test(g_app.host)) {
		// policy has an except pattern
		if(g_policy.except) {
			// compile except pattern
			let r_except: RegExp;
			try {
				r_except = new RegExp(g_policy.except);
			}
			// failed to parse policy
			catch(e_parse) {
				console.error(`Failed to parse policy match pattern "${g_policy.except}"`);
				return false;
			}

			// except pattern matches; skip policy
			if(r_except.test(g_app.host)) {
				return false;
			}
		}
	}

	// policy applies
	return true;
}


export const Policies = create_store_class({
	store: SI_STORE_APP_POLICIES,
	class: class PoliciesI extends WritableStore<typeof SI_STORE_APP_POLICIES> {
		static async forApp(g_app: AppInterface): Promise<AppPolicyResult> {
			return (await Policies.read()).forApp(g_app);
		}

		static blockApp(g_app: AppInterface, b_replace=false): Promise<void> {
			return Policies.open(ks_policies => ks_policies.blockApp(g_app, b_replace));
		}

		// eslint-disable-next-line @typescript-eslint/require-await
		forApp(g_app: AppInterface): AppPolicyResult {
			// prep trusted flag
			let b_trusted = false;

			// step thru each hq policy
			for(const g_policy of this._w_cache['hq']) {
				// policy applies
				if(policy_applies(g_policy, g_app)) {
					// blocked
					if('block' === g_policy.action) {
						return G_APP_POLICY_RESULT_BLOCKED;
					}
					// unknown
					else {
						console.error(`Unknown hq policy action "${g_policy.action}"`);
						continue;
					}
				}
			}

			// step thru each user policy
			for(const g_policy of this._w_cache['user']) {
				// policy applies
				if(policy_applies(g_policy, g_app)) {
					// blocked
					if('block' === g_policy.action) {
						return G_APP_POLICY_RESULT_BLOCKED;
					}
					// trusted only allowed from user
					else if('trust' === g_policy.action) {
						b_trusted = true;
					}
					// unknown
					else {
						console.error(`Unknown policy action "${g_policy.action as string}"`);
						continue;
					}
				}
			}

			// allowed
			return {
				blocked: false,
				trusted: b_trusted,
			};
		}


		/**
		 * Adds a user policy to the store
		 */
		async addUserPolicy(gp_add: AppPolicy, b_replace=false): Promise<void> {
			// ref user policies
			const a_user_policies = this._w_cache['user'];

			// search for exact matches
			for(let i_policy=0, nl_policies=a_user_policies.length; i_policy<nl_policies; i_policy++) {
				const gp_test = a_user_policies[i_policy];

				// another policy with this exact match pattern already exists
				if(gp_add.matches === gp_test.matches) {
					// replacement not enabled
					if(!b_replace) {
						throw new PolicyExistsError(`A policy matching "${gp_test.matches}" already exists.`);
					}

					// delete old policy
					a_user_policies.splice(i_policy, 1);

					// continue searching
					i_policy -= 1;
				}
			}

			// append policy to cache
			this._w_cache['user'].push(gp_add);

			// write to store
			await this.save();
		}


		/**
		 * Blocks an app
		 */
		blockApp(g_app: AppInterface, b_replace=false): Promise<void> {
			// escape regex characters in host string to form pattern
			const sx_regex_host = escape_regex(g_app.host);

			// add new policy
			return this.addUserPolicy({
				action: 'block',
				matches: sx_regex_host,
				except: '',
			}, b_replace);
		}
	},
});
