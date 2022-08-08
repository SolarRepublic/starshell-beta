import type { StoreKey } from '#/meta/store';

export const SI_VERSION = __SI_VERSION;

export const XT_SECONDS = 1e3;
export const XT_MINUTES = 60 * XT_SECONDS;
export const XT_HOURS = 60 * XT_MINUTES;
export const XT_DAYS = 24 * XT_HOURS;

// maximum byte length of a memo's input
export const NB_MAX_MEMO = 280;

// localhost pattern
export const R_DOMAIN_LOCALHOST = /^(localhost|127.0.0.1)(:\d+)?$/;

// ip address pattern
export const R_DOMAIN_IP = /^\d+(?:.\d+){3}(:\d+)?$/;

// bech32 parsing regex
export const R_BECH32 = /^(\w+)([13])([a-zA-HJ-NP-Z0-9]{25,39})$/;

// public suffix list
export const P_PUBLIC_SUFFIX_LIST = 'https://raw.githubusercontent.com/publicsuffix/list/master/public_suffix_list.dat';

// global decrees
export const P_STARSHELL_DECREES = 'https://raw.githubusercontent.com/SolarRepublic/wallet-decrees/main/global.json';

// transfer amount string regex
export const R_TRANSFER_AMOUNT = /^(\d+)(.+)/;


export const SI_STORE_SECRETS: StoreKey<'secrets'> = 'secrets';
export const SI_STORE_APPS: StoreKey<'apps'> = 'apps';
export const SI_STORE_APP_POLICIES: StoreKey<'app_policies'> = 'app_policies';
export const SI_STORE_AGENTS: StoreKey<'agents'> = 'agents';
export const SI_STORE_SETTINGS: StoreKey<'settings'> = 'settings';
export const SI_STORE_ACCOUNTS: StoreKey<'accounts'> = 'accounts';
export const SI_STORE_QUERY_CACHE: StoreKey<'query_cache'> = 'query_cache';
export const SI_STORE_TAGS: StoreKey<'tags'> = 'tags';
export const SI_STORE_MEDIA: StoreKey<'media'> = 'media';
export const SI_STORE_PFPS: StoreKey<'pfps'> = 'pfps';
export const SI_STORE_CHAINS: StoreKey<'chains'> = 'chains';
export const SI_STORE_NETWORKS: StoreKey<'networks'> = 'networks';
export const SI_STORE_ENTITIES: StoreKey<'entities'> = 'entities';
export const SI_STORE_EVENTS: StoreKey<'events'> = 'events';
export const SI_STORE_WEB_RESOURCES: StoreKey<'web_resources'> = 'web_resources';
export const SI_STORE_WEB_APIS: StoreKey<'web_apis'> = 'web_apis';
