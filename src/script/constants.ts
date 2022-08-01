export const NB_MAX_MESSAGE = 2 * 1024 * 1024;  // 2 MiB maximum

export const N_PX_WIDTH_POPUP = 360;
export const N_PX_HEIGHT_POPUP = 600;

export const A_CHAIN_FAMILIES = [
	'cosmos',
];

export const A_CHAIN_CATEGORIES = [
	'mainnet',
	'testnet',
];

// chain id pattern
export const R_CHAIN_ID = /^[a-z0-9][a-z0-9-]{2,64}$/;

// chain name pattern
export const R_CHAIN_NAME = /^[\p{L}\p{S}](\p{Zs}?[\p{L}\p{N}\p{S}._:/-])+$/u;
