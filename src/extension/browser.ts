import { Vault } from '#/crypto/vault';
import type {Dict, JsonObject} from '#/meta/belt';
import type { Vocab } from '#/meta/vocab';
import type {IntraExt, PageInfo, Pwa} from '#/script/messages';
import {once_storage_changes} from '#/script/service';
import {
	G_USERAGENT,
	XT_SECONDS,
	N_PX_WIDTH_POPUP,
	N_PX_HEIGHT_POPUP,
	N_PX_WIDTH_POPOUT,
	N_PX_HEIGHT_POPOUT,
	B_WITHIN_PWA,
	B_WEBEXT_ACTION,
	B_WEBEXT_BROWSER_ACTION,
	B_FIREFOX_ANDROID,
} from '#/share/constants';
import {F_NOOP} from '#/util/belt';
import { buffer_to_base64, text_to_buffer } from '#/util/data';
import {open_external_link, parse_params, stringify_params} from '#/util/dom';
import type { BrowserAction } from 'webextension-polyfill';
import { SessionStorage } from './session-storage';

export type PopoutWindowHandle = {
	window: chrome.windows.Window | null;
	tab: chrome.tabs.Tab | null;
};

export interface ScreenInfo {
	width: number;
	height: number;
	availWidth: number;
	availHeight: number;
	orientation: JsonObject | null;
	devicePixelRatio: number;
}

export interface PositionConfig extends JsonObject {
	centered?: boolean;
	centered_x?: boolean;
	left?: number;
	top?: number;
}

// get popup URL
export const P_POPUP = chrome.runtime?.getURL?.('src/entry/popup.html');

// get flow URL
export const P_FLOW = chrome.runtime?.getURL?.('src/entry/flow.html');

/**
 * Computes the center position of the entire desktop screen
 */
async function center_over_screen(): Promise<PositionConfig> {
	// not mobile
	if(['mobile', 'wearable', 'embedded'].includes(G_USERAGENT.device.type || '')) {
		return {};
	}

	// cannot create windows
	if('function' !== typeof chrome.windows?.create) {
		return {};
	}

	// fetch displays and screen info
	const [
		a_displays,
		g_screen_info,
	] = await Promise.all([
		chrome.system.display.getInfo(),

		(async(): Promise<ScreenInfo | undefined> => {
			// create popup to determine screen dimensions
			const g_info = await SessionStorage.get('display_info');
			if(g_info) return g_info;

			// create center-gathering window
			chrome.windows.create({
				type: 'popup',
				url: P_FLOW+'?'+new URLSearchParams({headless:'info'}).toString(),
				focused: true,
				width: N_PX_WIDTH_POPOUT,
				height: N_PX_HEIGHT_POPOUT,
			}, F_NOOP);

			try {
				return (await once_storage_changes('session', 'display_info', 5*XT_SECONDS))?.newValue;
			}
			catch(e_timeout) {}
		})(),
	]);

	// create displays dict
	const h_displays = {};
	for(const g_display of a_displays) {
		if(g_display.isEnabled) {
			h_displays[g_display.bounds.width+':'+g_display.bounds.height] = g_display;
		}
	}

	// set display propertiess to be center of screen
	if(g_screen_info) {
		const si_display = g_screen_info.width+':'+g_screen_info.height;
		const g_display = h_displays[si_display];
		if(g_display) {
			return {
				centered: true,
				left: g_display.bounds.left + (g_screen_info.width / 2),
				top: g_display.bounds.top + (g_screen_info.height * 0.45),
			};
		}
	}

	return {};
}

export interface OpenWindowConfig extends JsonObject {
	/**
	 * Creates a standalone window in order to escape the popover
	 */
	popout?: boolean;

	position?: PositionConfig;

	/**
	 * If set to non-zero integer, describes the tab id to open a popover above
	 */
	popover?: PageInfo;
}

/**
 * Computes the center position of the current popup
 */
function center_over_current() {
	const x_left = globalThis.screenLeft;
	const x_top = globalThis.screenTop;

	return {
		centered_x: true,
		left: x_left + (globalThis.outerWidth / 2),
		top: x_top - 20,  // account for roughly 20px of window chrome
	};
}

/**
 * Opens a new window. Position defaults to the center of the currently active screen
 */
export async function open_window(p_url: string, gc_open?: OpenWindowConfig): Promise<PopoutWindowHandle> {
	// parse url
	const d_url = new URL(p_url);

	// parse params
	const h_params = parse_params(d_url.search.slice(1));

	// determine center screen position for new window
	let g_window_position: PositionConfig = {};
	if(gc_open?.position) {
		g_window_position = gc_open.position;
	}
	else if(gc_open?.popout && 'number' === typeof globalThis.screenLeft) {
		g_window_position = center_over_current();
	}
	else {
		g_window_position = await center_over_screen();
	}

	// use popover
	if(gc_open?.popover && !B_FIREFOX_ANDROID) {
		// update url with extended search params
		const d_url_popover = new URL(p_url);
		d_url_popover.search = stringify_params({
			...h_params,
			within: 'popover',
		});

		// reserialize
		const p_url_popover = d_url_popover.toString();

		// attempt to open popover
		try {
			if(B_WEBEXT_ACTION) {
				await chrome.action.setPopup({
					popup: p_url_popover,
					tabId: gc_open.popover.tabId,
				});

				await chrome.action.openPopup({
					windowId: gc_open.popover.windowId,
				});
			}
			else if(B_WEBEXT_BROWSER_ACTION) {
				await chrome.browserAction.setPopup({
					popup: p_url_popover,
					tabId: gc_open.popover.tabId,
				});

				await (chrome.browserAction as BrowserAction.Static).openPopup();
			}

			// popover is not referencable
			return {
				window: null,
				tab: null,
			};
		}
		// error opening popover, user may have navigated to other tab
		catch(e_open) {
			// procced with fallback
			console.warn(`Popover attempt failed: ${e_open}; using fallback`);
		}
		// reset popover
		finally {
			if(B_WEBEXT_ACTION) {
				void chrome.action.setPopup({
					popup: P_POPUP,
					tabId: gc_open.popover.tabId,
				});
			}
			else if(B_WEBEXT_BROWSER_ACTION) {
				void chrome.browserAction.setPopup({
					popup: P_POPUP,
					tabId: gc_open.popover.tabId,
				});
			}
		}
	}

	// within pwa
	if(B_WITHIN_PWA) {
		debugger;

		// prep URL
		const f_url = (h_hash_params: Dict) => `https://launch.starshell.net/?pwa#${new URLSearchParams(Object.entries({
			flow: p_url,
			...h_hash_params,
		}))}`;

		// sign URL
		const p_presigned = f_url({});
		const atu8_signature = await Vault.symmetricSign(text_to_buffer(p_presigned));

		// append to hash params
		const p_signed = f_url({
			signature: buffer_to_base64(atu8_signature),
		});

		// // open as if a remote page
		// window.open(p_signed, '_blank');

		// instruct top to open popup
		(window.top as Vocab.TypedWindow<Pwa.IframeToTop>).postMessage({
			type: 'openPopup',
			value: p_url,
		}, 'https://launch.starshell.net');

		return {
			window: null,
			tab: null,
		};
	}
	// windows is available
	else if('function' === typeof chrome.windows?.create) {
		// extend search params
		h_params.within = 'popout';

		// update url
		d_url.search = new URLSearchParams(h_params as Dict).toString();

		// reserialize
		p_url = d_url.toString();

		// set dimensinos
		const n_px_width = N_PX_WIDTH_POPOUT;
		const n_px_height = N_PX_HEIGHT_POPOUT;

		// whether position should be centered
		const b_centered = true === g_window_position.centered;

		// window position top
		let n_px_top = 0;
		if('number' === typeof g_window_position.top) {
			n_px_top = Math.round(g_window_position.top - (b_centered? n_px_height / 2: 0));
		}

		// window position left
		let n_px_left = 0;
		if('number' === typeof g_window_position.left) {
			n_px_left = Math.round(g_window_position.left - (b_centered || g_window_position.centered_x? n_px_width / 2: 0));
		}

		// create window
		const g_window = await chrome.windows.create({
			type: 'popup',
			url: p_url,
			focused: true,
			width: n_px_width,
			height: n_px_height,
			top: n_px_top,
			left: n_px_left,
		});

		// window was not created
		if('number' !== typeof g_window.id) {
			throw new Error('Failed to create popup window');
		}

		try {
			// fetch its view
			const dv_popup = await chrome.windows.get(g_window.id, {
				windowTypes: ['popup'],
			});

			// no view
			if(!dv_popup) {
				throw new Error('Failed to locate popup window');
			}

			// wait for tab to load
			const dt_created: chrome.tabs.Tab = await new Promise((fk_created) => {
				// tab update event
				chrome.tabs.onUpdated.addListener(function tab_update(i_tab, g_info, dt_updated) {
					// is the target tab
					if(g_window.id === dt_updated.windowId && 'number' === typeof i_tab) {
						// loading compelted
						if('complete' === g_info.status) {
							// remove listener
							chrome.tabs.onUpdated.removeListener(tab_update);

							// resolve promise
							fk_created(dt_updated as chrome.tabs.Tab);
						}
					}
				});
			});

			return {
				window: g_window,
				tab: dt_created,
			};
		}
		catch(e_create) {}
	}

	// cannot create windows, but can create tabs
	if('function' === typeof chrome.tabs?.create) {
		// set viewing mode
		h_params.within = 'tab';

		// reserialize url
		d_url.search = stringify_params(h_params);

		return {
			window: null,
			tab: await chrome.tabs.create({
				url: d_url.toString(),
			}),
		};
	}
	// open as link
	else {
		// treat as external link
		open_external_link(p_url);

		return {
			window: null,
			tab: null,
		};
	}
}
