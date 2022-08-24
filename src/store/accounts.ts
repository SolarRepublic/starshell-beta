import type { Account, AccountPath } from '#/meta/account';
import type { Bech32, FamilyKey } from '#/meta/chain';
import type { Resource } from '#/meta/resource';

import {
	create_store_class,
	WritableStoreMap,
} from './_base';

import { SI_STORE_ACCOUNTS } from '#/share/constants';
import type { Replace } from 'ts-toolbelt/out/String/Replace';
import { ode } from '#/util/belt';
import { yw_chain } from '#/app/mem';
import { Chains } from './chains';

type PathFor<
	si_family extends FamilyKey,
	s_pubkey extends string,
> = `/family.${si_family}/account.${Replace<s_pubkey, ':', '+'>}`;

type PathFromAccount<
	g_account extends Account['interface'],
> = PathFor<g_account['family'], g_account['pubkey']>;

export class NoAccountOwner extends Error {}

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

		static async get(si_family: FamilyKey, s_pubkey: string): Promise<null | Account['interface']> {
			return (await Accounts.read()).get(si_family, s_pubkey);
		}

		static async find(sa_owner: Bech32.String, g_chain=yw_chain.get()): Promise<[AccountPath, Account['interface']]> {
			return (await Accounts.read()).find(sa_owner, g_chain);
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

		find(sa_owner: Bech32.String, g_chain=yw_chain.get()): [AccountPath, Account['interface']] {
			for(const [p_account, g_account] of ode(this._w_cache)) {
				const sa_test = Chains.addressFor(g_account.pubkey, g_chain);
				if(sa_test === sa_owner) {
					return [p_account, g_account];
				}
			}

			throw new NoAccountOwner(`The address ${sa_owner} does not belong to any accounts in the wallet`);
		}
	},
});
