import type { App } from '#/meta/app';

import {
	create_store_class,
	WritableStore,
} from './_base';

import { SI_STORE_APP_POLICIES } from '#/share/constants';


export type AppPolicy = {
	action: 'block' | 'trust';
	matches: string;
	except: string;
}

export type AppPolicyResult = {
	blocked: true;
} | {
	blocked: false;

	// indicates that the user does not need 
	trusted: boolean;
};

const G_APP_POLICY_RESULT_BLOCKED: AppPolicyResult = {
	blocked: true,
};


function policy_applies(g_policy: AppPolicy, g_app: App['interface']): boolean {
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
	class: class PoliciesI extends WritableStore<typeof SI_STORE_APP_POLICIES, AppPolicy> {
		static forApp(g_app: App['interface']): Promise<AppPolicyResult> {
			return Policies.open(ks_policies => ks_policies.forApp(g_app));
		}

		// eslint-disable-next-line @typescript-eslint/require-await
		forApp(g_app: App['interface']): AppPolicyResult {
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
						console.error(`Unknown policy action "${g_policy.action}"`);
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
	},
});
