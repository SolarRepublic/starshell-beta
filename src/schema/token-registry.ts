import type { TokenSpecKey } from '#/meta/token';

type TokenEntry = {
	extends?: TokenSpecKey;
	attributes: {
		fungible: boolean;
	};
};

export const TokenRegistry: Record<TokenSpecKey, TokenEntry> = {
	'cw-20': {
		attributes: {
			fungible: false,
		},
	},

	'snip-20': {
		attributes: {
			fungible: true,
		},
	},

	'snip-21': {
		extends: 'snip-20',
		attributes: {
			fungible: true,
		},
	},

	'snip-24': {
		extends: 'snip-20',
		attributes: {
			fungible: true,
		},
	},

	'snip-721': {
		attributes: {
			fungible: false,
		},
	},

	'snip-722': {
		extends: 'snip-721',
		attributes: {
			fungible: false,
		},
	},
};
