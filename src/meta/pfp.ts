import type { Merge } from 'ts-toolbelt/out/Object/Merge';
import type { ImageMedia, ImageMediaTarget } from './media';
import type {Resource} from './resource';


export type ImageSet = {
	default: ImageMediaTarget;
	16?: ImageMediaTarget;
	32?: ImageMediaTarget;
	48?: ImageMediaTarget;
	64?: ImageMediaTarget;
	96?: ImageMediaTarget;
	128?: ImageMediaTarget;
	192?: ImageMediaTarget;
	256?: ImageMediaTarget;
};

export interface PfpTypeRegistry {
	plain: {
		interface: {
			image: ImageSet;
		};
	};

	pair: {
		interface: {
			images: [ImageSet, ImageSet];
		};
	};

	composite: {
		interface: {
			bg: ImageSet;
			fg: ImageSet;
		};
	};
}

export type PfpTypeKey = keyof PfpTypeRegistry;

export type PfpType<
	si_type extends PfpTypeKey=PfpTypeKey,
> = {
	[si_each in PfpTypeKey]: Merge<{
		type: si_each;
	}, PfpTypeRegistry[si_each]['interface']>;
}[si_type];


export type Pfp<
	si_type extends PfpTypeKey=PfpTypeKey,
> = Resource.New<{
	segments: ['template.pfp', `uuid.${string}`];
	interface: PfpType<si_type>;
}>;

export type PfpPath<
	si_type extends PfpTypeKey=PfpTypeKey,
> = Resource.Path<Pfp<si_type>>;

export type PfpTarget = PfpPath | `pfp:${string}` | '';

export type PfpInterface<
	si_type extends PfpTypeKey=PfpTypeKey,
> = Pfp<si_type>['interface'];
