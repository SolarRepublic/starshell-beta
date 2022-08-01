import type { Account } from '#/meta/account';
import type { FamilyKey } from '#/meta/chain';
import type { Resource } from '#/meta/resource';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import { SI_STORE_ACCOUNTS } from '#/share/constants';
import type { Replace } from 'ts-toolbelt/out/String/Replace';

type PathFor<
	si_family extends FamilyKey,
	s_pubkey extends string,
> = `/family.${si_family}/account.${Replace<s_pubkey, ':', '+'>}`;

type PathFromAccount<
	g_account extends Account['interface'],
> = PathFor<g_account['family'], g_account['pubkey']>;

export const Accounts = create_store_class({
	store: SI_STORE_ACCOUNTS,
	extension: 'map',
	class: class AccountsI extends WritableStoreMap<typeof SI_STORE_ACCOUNTS> {
		static pathFor<
			si_family extends FamilyKey,
			s_pubkey extends string,
		>(si_family: si_family, s_pubkey: s_pubkey): PathFor<si_family, s_pubkey> {
			return `/family.${si_family}/account.${s_pubkey.replace(/:/g, '+')}` as PathFor<si_family, s_pubkey>;
		}

		static pathFrom(g_account: Account['interface']): PathFromAccount<typeof g_account> {
			return AccountsI.pathFor(g_account.family, g_account.pubkey);
		}

		static get(si_family: FamilyKey, s_pubkey: string): Promise<null | Account['interface']> {
			return Accounts.open(ks => ks.get(si_family, s_pubkey));
		}

		get(si_family: FamilyKey, s_pubkey: string): Account['interface'] | null {
			// prepare path
			const p_res = AccountsI.pathFor(si_family, s_pubkey);

			// fetch
			return this._w_cache[p_res] ?? null;
		}

		async put(g_account: Account['interface']): Promise<PathFromAccount<typeof g_account>> {
			// prepare path
			const p_res = AccountsI.pathFrom(g_account);

			// update cache
			this._w_cache[p_res] = g_account;

			// attempt to save
			await this.save();

			// return path
			return p_res;
		}
	},
});
