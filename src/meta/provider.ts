import type {Nameable, Pfpable} from './able';
import type {ChainPath} from './chain';
import type {Resource} from './resource';


export type Provider = Resource.New<{
	segments: [`provider.${string}`];
	struct: [{
		chain: ChainPath;
		grpcWebUrl: string;
		rpcHost?: string;
	}, Nameable, Pfpable];
}>;

export type ProviderPath = Resource.Path<Provider>;
export type ProviderStruct = Provider['struct'];
