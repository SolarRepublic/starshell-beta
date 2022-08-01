import type {Resource} from './resource';


// export type Media = Resource.New<{
// 	segments: ['media'],
// 	interface: {

// 	};
// }>;

export type MediaTypeRegistry = {
	'image/png': {};
};

export type MediaTypeKey = keyof MediaTypeRegistry;

export type ImageMedia<
	s_mime extends MediaTypeKey=MediaTypeKey,
	s_hash extends string=string,
> = Resource.New<{
	// extends: Media;
	segments: ['media.image', `sha256.${s_hash}`];
	interface: {
		hash: s_hash;
		data: string;
	};
}>;

export type ImageMediaPath = Resource.Path<ImageMedia>;

export type Media = ImageMedia;
