import type { ImageMedia } from './media';
import type { Pfp, PfpPath } from './pfp';
import type { Resource } from './resource';

export type Nameable = {
	name: string;
};

export type Pfpable = {
	pfp: PfpPath;
};
