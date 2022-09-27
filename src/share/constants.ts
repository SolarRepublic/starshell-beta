import UAParser from 'ua-parser-js';
import type {StoreKey} from '#/meta/store';
import {sha256_sync_insecure, text_to_buffer} from '#/util/data';
import { parse_params } from '#/util/dom';
import type { BrowserAction } from 'webextension-polyfill';

// export const $_IS_SERVICE_WORKER = Symbol('service-worker');
export const $_IS_SERVICE_WORKER = '__is_service_worker';

export const SI_VERSION = __SI_VERSION;
export const SI_ENGINE = __SI_ENGINE;

// get URL params
export const H_PARAMS = parse_params();

export const G_USERAGENT = new UAParser().getResult();
export const B_MOBILE = 'mobile' === G_USERAGENT.device.type;
export const B_SAFARI_MOBILE = 'Mobile Safari' === G_USERAGENT.browser.name;
export const B_IPHONE_IOS = 'iPhone' === G_USERAGENT.device.model && 'iOS' === G_USERAGENT.os.name;
export const B_FIREFOX_ANDROID = 'Firefox' === G_USERAGENT.browser.name && 'Android' === G_USERAGENT.os.name;

export const N_FIREFOX_ANDROID_BETA_VERSION = 104;
export const N_FIREFOX_ANDROID_NIGHTLY_ABOVE = N_FIREFOX_ANDROID_BETA_VERSION;

interface WebExtParams {
	/**
	 * Identifies the containing browser viewport mode
	 *  - _(undefined)_: the native popover
	 *  - popout: an independently positionable singleton desktop window
	 *  - pwa: installed PWA (on android firefox)
	 *  - tab: `{vendor}-extension://` browser tab
	 */
	within?: 'popout' | 'pwa' | 'tab';
}

export const B_WITHIN_IFRAME = 'object' === typeof window && globalThis === window && window.top !== window;

// set to true if the window is within a web extension popover
export const B_WITHIN_WEBEXT_POPOVER = !('within' in H_PARAMS) || 'popover' === H_PARAMS.within;

// set to true if the window is within a pwa
export const B_WITHIN_PWA = B_WITHIN_IFRAME && 'pwa' === H_PARAMS.within;

// web ext API mode
export const B_WEBEXT_ACTION = 'function' === typeof chrome.action?.openPopup;
export const B_WEBEXT_BROWSER_ACTION = 'function' === typeof (chrome.browserAction as BrowserAction.Static)?.openPopup;

// firefox android toolbar is 56px high
export const N_PX_FIREFOX_TOOLBAR = 56;


export const XT_SECONDS = 1e3;
export const XT_MINUTES = 60 * XT_SECONDS;
export const XT_HOURS = 60 * XT_MINUTES;
export const XT_DAYS = 24 * XT_HOURS;

// default popup dimensions are limited to a maximum set by chrome
export const N_PX_WIDTH_POPUP = 360;
export const N_PX_HEIGHT_POPUP = 600;

// popout dimensions can be slightly larger for flows
export const N_PX_WIDTH_POPOUT = 390;
export const N_PX_HEIGHT_POPOUT = 690;

// maximum data icon size in characters
export const NL_DATA_ICON_MAX = 2 * 1024 * 1024;  // approximately 2 MiB

// square dimensions at which to render icon
export const N_PX_DIM_ICON = 256;

// maximum byte length of a memo's input
export const NB_MAX_MEMO = 188;

// maximum byte length of a serialized message to accept from a web page
export const NB_MAX_MESSAGE = 2 * 1024 * 1024;  // 2 MiB maximum

// localhost pattern
export const R_DOMAIN_LOCALHOST = /^(localhost|127.0.0.1)(:\d+)?$/;

// ip address pattern
export const R_DOMAIN_IP = /^\d+(?:.\d+){3}(:\d+)?$/;


export const R_BIP_44 = /^m\/44'(\/[0-9]+'){2}(\/[0-9]+){2}$/;

/** 
 * Bech32 parsing regex. {@link https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki BIP-173 speicifcation}
 * 
 * Capture groups:
 *  1. HRP
 *  2. separator
 *  3. data
 *  4. checksum
 */
export const R_BECH32 = /^(.{0,32})(1)([02-9ac-hj-np-z]{1,84}?)(.{6})$/;


/**
 * CAIP-2 chain_namespace
 */
export const RT_CAIP_2_NAMESPACE = /^[-a-z0-9]{3,8}$/;


/**
 * CAIP-2 chain_reference
 */
export const RT_CAIP_2_REFERENCE = /^[-a-zA-Z0-9]{1,32}$/;


/**
 * CAIP-2 parsing regex. {@link https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md CAIP-2 specification}
 * 
 * Capture groups:
 *  1. caip2 chain_namespace
 *  2. caip2 chain_reference
 */
export const R_CAIP_2 = /^([-a-z0-9]{3,8}):([-a-zA-Z0-9]{1,32})$/;


/**
 * CAIP-10: {@link https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-10.md CAIP-10 specification}
 * 
 * Capture groups:
 *  1. caip2 chain_namespace
 *  2. caip2 chain_reference
 *  3. caip10 account_address
 */
export const R_CAIP_10 = /^([-a-z0-9]{3,8}):([-a-zA-Z0-9]{1,32}):([a-zA-Z0-9]{1,64})/;


/**
 * CAIP-19 {@link https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-19.md CAIP-19 specification}
 * 
 * Capture groups:
 *  1. caip2 chain_namespace
 *  2. caip2 chain_reference
 *  3. caip19 asset_namespace
 *  4. caip19 asset_reference
 */
export const R_CAIP_19 = /^([-a-z0-9]{3,8}):([-a-zA-Z0-9]{1,32})\/([-a-z0-9]{3,8}):([-a-zA-Z0-9]{1,64})$/;


// chain id pattern w/ versioning (cosmos standard pending) <https://github.com/cosmos/cosmos-sdk/issues/5363>
export const R_CHAIN_ID_VERSION = /^([a-zA-Z0-9][a-zA-Z0-9-]*?)-([1-9][0-9]{0,44})$/;

// chain name pattern
export const R_CHAIN_NAME = /^[\p{L}\p{S}](\p{Zs}?[\p{L}\p{N}\p{S}._:/-])+$/u;

// contract name pattern (same as chain name but with extra special characters allowed and different length limits)
export const R_CONTRACT_NAME = /^[\p{L}\p{S}](\p{Zs}?[\p{L}\p{N}\p{S}!@#$%^&*()-=_+[\]{}|;':",./<>?]){3,33}$/u;

/**
 * The token symbol pattern is the most complex of all the expressions. It is designed to encourage concise and consistent
 * naming conventions to make symbols simple and predictable to the end user, while also allowing certain edge cases for
 * developers.
 * 
 * The approximate grammar for this pattern:
 * 
 * SYMBOL: opening subsequent{0,2}
 * opening: lowercase-letter{0,3} plain-symbol{1,12}
 * plain-symbol: uppercase-letter | numeric-character
 * subsequent: (symbol | punctuation | separator) supplemental
 * supplemental: lowercase-letter{0,3} (plain-symbol | "(" | ")" | "[" | "]"){1,12}
 */
export const R_TOKEN_SYMBOL = /^([\p{Ll}]{0,3}[\p{Lu}\p{N}]{1,12})([\p{S}\p{P}\p{Z}]{1,2}[\p{Ll}]{0,3}[\p{Lu}\p{N}()[\]]{1,12}){0,2}$/u;

/**
 * Data image URL for acceptable formats from the web
 */
export const R_DATA_IMAGE_URL_WEB = /^data:image\/(png|webp);base64,(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{3}=|[A-Za-z\d+/]{2}==)?$/;

/**
 * Data image URL for acceptable formats internally (i.e., in trusted contexts)
 */
export const R_DATA_IMAGE_URL_ANY = /^data:image\/(png|webp|jpeg|svg\+xml);base64,(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{3}=|[A-Za-z\d+/]{2}==)?$/;

export const R_SCRT_COMPUTE_ERROR = /;\s*message index: (\d+):\s*encrypted:\s*([A-Za-z\d+/=]+):\s*([\w-.]+) contract failed/;

// public suffix list
export const P_PUBLIC_SUFFIX_LIST = 'https://raw.githubusercontent.com/publicsuffix/list/master/public_suffix_list.dat';

// global decrees
export const P_STARSHELL_DECREES = 'https://raw.githubusercontent.com/SolarRepublic/wallet-decrees/main/global.json';

// transfer amount string regex
export const R_TRANSFER_AMOUNT = /^(\d+)(.+)/;

// size of pagination limit for synchronization queries
export const XG_SYNCHRONIZE_PAGINATION_LIMIT = 16n;


// cache dummy values to estimate time to completion
export const ATU8_DUMMY_PHRASE = text_to_buffer('32-character-long-dummy-password');
export const ATU8_DUMMY_VECTOR = new Uint8Array(crypto.getRandomValues(new Uint8Array(16)));

// minimum password length
export const NL_PASSPHRASE_MINIMUM = 5;

// maximum password length
export const NL_PASSPHRASE_MAXIMUM = 1024;


// sha256("starshell")
export const ATU8_SHA256_STARSHELL = sha256_sync_insecure(text_to_buffer('starshell'));

// sha512("starshell")
export const ATU8_SHA512_STARSHELL = sha256_sync_insecure(text_to_buffer('starshell'));


export const XT_INTERVAL_HEARTBEAT = 200;


export const XG_64_BIT_MAX = (2n ** 64n) - 1n;


// default chain namepsaces
export const A_CHAIN_NAMESPACES = [
	'cosmos',
];

// default chain categories
export const A_CHAIN_CATEGORIES = [
	'mainnet',
	'testnet',
];


export const SI_STORE_SECRETS: StoreKey<'secrets'> = 'secrets';
export const SI_STORE_APPS: StoreKey<'apps'> = 'apps';
export const SI_STORE_APP_POLICIES: StoreKey<'app_policies'> = 'app_policies';
export const SI_STORE_AGENTS: StoreKey<'agents'> = 'agents';
export const SI_STORE_CONTRACTS: StoreKey<'contracts'> = 'contracts';
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

export {A_KEPLR_EMBEDDED_CHAINS, A_TESTNETS} from './keplr-exports';
