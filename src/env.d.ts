/// <reference types="chrome" />
/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="@samrum/vite-plugin-web-extension/client" />

import type { ImageMedia } from './meta/media';
import type { Resource } from './meta/resource';
import type { Store } from './meta/store';
import type { SI_STORE_MEDIA } from './share/constants';
import type { Dict } from './util/belt';

interface ImportMetaEnv {
	MV3: boolean;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

// proprietary method for inlining code from a dependency directly into the compiled source
declare function inline_require(s_dependency: string): any;

declare global {
	const __H_MEDIA_BUILTIN: Store.Cache<typeof SI_STORE_MEDIA>;
	const __H_MEDIA_LOOKUP: Dict<Resource.Path<ImageMedia>>;
	const __SI_VERSION: string;
	const __SI_PLATFORM: string;
}
