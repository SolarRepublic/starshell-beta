import type {Nameable, Pfpable} from './able';
import type {Agent, ChainPath, Family, FamilyKey} from './chain';
import type {Resource} from './resource';

export enum ContactAgentType {
	PERSON = 'person',
	CONTRACT = 'contract',
}

/**
 * A contact is an agent that the user has assigned information to
 */
export type ContactSpace = Extract<keyof Family.Bech32s, 'acc'>;

export type Contact<
	si_family extends FamilyKey=FamilyKey,
	sa_contact extends string=string,
	si_space extends ContactSpace=ContactSpace,
> = Resource.New<{
	extends: Agent<si_family, sa_contact, si_space>;
	segment: 'as.contact';
	interface: [{
		notes: string;
		agentType: ContactAgentType;
		space: si_space extends `${infer s}`? s: string;
		family: si_family;
		chains: Record<ChainPath, {}>;
	}, Nameable, Pfpable];
}>;

export type ContactPath = Resource.Path<Contact>;
