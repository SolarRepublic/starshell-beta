import UAParser from 'ua-parser-js';
import type { StoreKey } from '#/meta/store';

export const SI_VERSION = __SI_VERSION;
export const SI_PLATFORM = __SI_PLATFORM;

export const G_USERAGENT = new UAParser().getResult();
export const B_MOBILE = 'mobile' === G_USERAGENT.device.type;

export const XT_SECONDS = 1e3;
export const XT_MINUTES = 60 * XT_SECONDS;
export const XT_HOURS = 60 * XT_MINUTES;
export const XT_DAYS = 24 * XT_HOURS;

// maximum byte length of a memo's input
export const NB_MAX_MEMO = 188;

// localhost pattern
export const R_DOMAIN_LOCALHOST = /^(localhost|127.0.0.1)(:\d+)?$/;

// ip address pattern
export const R_DOMAIN_IP = /^\d+(?:.\d+){3}(:\d+)?$/;

// bech32 parsing regex
export const R_BECH32 = /^([a-z]+)([13])([a-zA-HJ-NP-Z0-9]{25,39})$/;

// public suffix list
export const P_PUBLIC_SUFFIX_LIST = 'https://raw.githubusercontent.com/publicsuffix/list/master/public_suffix_list.dat';

// global decrees
export const P_STARSHELL_DECREES = 'https://raw.githubusercontent.com/SolarRepublic/wallet-decrees/main/global.json';

// transfer amount string regex
export const R_TRANSFER_AMOUNT = /^(\d+)(.+)/;

// size of pagination limit for synchronization queries
export const XG_SYNCHRONIZE_PAGINATION_LIMIT = 16n;


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
export const SI_STORE_INCIDENTS: StoreKey<'incidents'> = 'incidents';
export const SI_STORE_HISTORIES: StoreKey<'histories'> = 'histories';
export const SI_STORE_WEB_RESOURCES: StoreKey<'web_resources'> = 'web_resources';
export const SI_STORE_WEB_APIS: StoreKey<'web_apis'> = 'web_apis';
