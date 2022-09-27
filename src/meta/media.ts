import type { Compute } from 'ts-toolbelt/out/Any/Compute';
import type {Resource} from './resource';


// export type Media = Resource.New<{
// 	segments: ['media'],
// 	interface: {

// 	};
// }>;

export type MediaTypeRegistry = {
	'image': {};
};

export type MediaTypeKey = keyof MediaTypeRegistry;

export type ImageMedia<
	si_media extends MediaTypeKey=MediaTypeKey,
	s_hash extends string=string,
> = Resource.New<{
	// extends: Media;
	segments: [`media.${si_media}`, `sha256.${s_hash}`];
	interface: {
		hash: s_hash;
		data: string;
	};
}>;

export type ImageDataUrl = `data:image/${'png' | 'webp'};base64,${string}`;

export type ImageMediaPath<
	si_media extends MediaTypeKey=MediaTypeKey,
	s_hash extends string=string,
> = Resource.Path<ImageMedia<si_media, s_hash>>;
export type ImageMediaTarget = ImageMediaPath | ImageDataUrl;
export type ImageMediaInterface = ImageMedia['interface'];

export type Media = ImageMedia;
export type MediaPath<
	si_media extends MediaTypeKey=MediaTypeKey,
	s_hash extends string=string,
> = ImageMediaPath<si_media, s_hash>;
export type Mediatarget = ImageMediaTarget;
export type MediaInterface = ImageMediaInterface;
