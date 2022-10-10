import type {Nameable, Pfpable} from './able';
import type {ChainPath} from './chain';
import type {Resource} from './resource';


export type Provider = Resource.New<{
	segments: [`provider.${string}`];
	interface: [{
		chain: ChainPath;
		grpcWebUrl: string;
		rpcHost?: string;
	}, Nameable, Pfpable];
}>;

export type ProviderPath = Resource.Path<Provider>;
export type ProviderInterface = Provider['interface'];
