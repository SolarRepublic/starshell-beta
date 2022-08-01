import type { Nameable, Pfpable } from './able';
import type { Chain, ChainPath, Family, FamilyKey } from './chain';
import type {Resource} from './resource';


export type Network = Resource.New<{
	segments: [`network.${string}`];
	interface: [{
		chain: ChainPath;
		grpcWebUrl: string;
		rpcHost?: string;
	}, Nameable, Pfpable];
}>;

export type NetworkPath = Resource.Path<Network>;
