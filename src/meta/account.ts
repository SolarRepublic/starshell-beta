import type { Dict, JsonObject } from '#/util/belt';
import type {Nameable, Pfpable} from './able';
import type {ChainPath, Family, FamilyKey} from './chain';
import type {Resource} from './resource';
import type { Secret, SecretPath } from './secret';


export type Account<
	si_family extends FamilyKey=FamilyKey,
	s_pubkey extends string=string,
> = Resource.New<{
	segments: [Family.Segment<si_family>, `account.${s_pubkey}`];
	interface: [{
		family: si_family;
		pubkey: s_pubkey;
		secret: SecretPath;
		extra?: Dict<any>;
	}, Nameable, Pfpable];
}>;

export type AccountPath = Resource.Path<Account>;


// export type NamedThingsMap = DataMap<Account | Chain, string>;

// const NamedThings: NamedThingsMap = {
// 	'/family.cosmos/account.0': 'Account Mars',

// };


