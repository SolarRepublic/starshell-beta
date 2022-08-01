import type { ImageMedia, ImageMediaPath } from './media';
import type {Resource} from './resource';


export type ImageSet = {
	default: ImageMediaPath;
	16?: ImageMediaPath;
	32?: ImageMediaPath;
	48?: ImageMediaPath;
	64?: ImageMediaPath;
	96?: ImageMediaPath;
	128?: ImageMediaPath;
	192?: ImageMediaPath;
	256?: ImageMediaPath;
};

export type PfpStyle = {
	type: 'plain';
	image: ImageSet;
} | {
	type: 'pair';
	images: [ImageSet, ImageSet];
} | {
	type: 'composite';
	bg: ImageSet;
	fg: ImageSet;
};

export type Pfp = Resource.New<{
	segments: ['template.pfp', `id.${number}`];
	interface: PfpStyle;
}>;

export type PfpPath = Resource.Path<Pfp>;
