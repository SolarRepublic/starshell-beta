import { session_storage_get } from "#/crypto/vault";
import { N_PX_HEIGHT_POPUP, N_PX_WIDTH_POPUP } from "#/script/constants";
import { once_storage_changes } from "#/script/service";
import { G_USERAGENT, XT_SECONDS } from "#/share/constants";
import { F_NOOP, JsonObject } from "#/util/belt";

export type PopoutWindowHandle = {
	window: chrome.windows.Window | null;
	tab: chrome.tabs.Tab;
};

export interface ScreenInfo {
	width: number;
	height: number;
	availWidth: number;
	availHeight: number;
	orientation: JsonObject | null;
	devicePixelRatio: number;
}

// get popup URL
export const P_POPUP = chrome.runtime.getURL('src/entry/popup.html');

// get flow URL
export const P_FLOW = chrome.runtime.getURL('src/entry/flow.html');

async function center_window_position(): Promise<{left?:number; top?:number}> {
	// not mobile
	if(['mobile', 'wearable', 'embedded'].includes(G_USERAGENT.device.type || '')) {
		return {};
	}

	// cannot create windows
	if(!chrome.windows.create) {
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
			const g_info = (await session_storage_get('display_info'))?.display_info;
			if(g_info) return g_info;

			// create center-gathering window
			chrome.windows.create({
				type: 'popup',
				url: P_FLOW+'?'+new URLSearchParams({headless:'info'}).toString(),
				focused: true,
				width: N_PX_WIDTH_POPUP,
				height: N_PX_HEIGHT_POPUP,
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
				left: g_display.bounds.left + Math.round((g_screen_info.width / 2) - (N_PX_WIDTH_POPUP / 2)),
				top: g_display.bounds.top + Math.round((g_screen_info.height * 0.45) - (N_PX_HEIGHT_POPUP / 2)),
			};
		}
	}

	return {};
}

export interface OpenWindowConfig extends JsonObject {
	popout?: boolean;
	position?: {
		left: number;
		top: number;
	};
}

function center_over_position() {
	const x_left = globalThis.screenLeft;
	const x_top = globalThis.screenTop;

	const x_center_x = (x_left + (globalThis.outerWidth / 2));
	const x_center_y = (x_top + (globalThis.outerHeight / 2));

	return {
		left: Math.round(x_center_x - (N_PX_WIDTH_POPUP / 2)),
		top: Math.round(x_center_y - (N_PX_HEIGHT_POPUP / 2)),
	};
}

/**
 * Opens a new window. Position defaults to the center of the currently active screen
 */
export async function open_window(p_url: string, gc_open?: OpenWindowConfig): Promise<PopoutWindowHandle> {
	// determine center screen position for new window
	const g_window_position = gc_open?.position ?? gc_open?.popout? center_over_position(): await center_window_position();

	// windows is available
	if(chrome.windows.create) {
		// create window
		const g_window = await chrome.windows.create({
			type: 'popup',
			url: p_url,
			focused: true,
			width: N_PX_WIDTH_POPUP,
			height: N_PX_HEIGHT_POPUP,
			...g_window_position,
		});

		// window was not created
		if('number' !== typeof g_window.id) {
			throw new Error('Failed to create popup window');
		}

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
						fk_created(dt_updated);
					}
				}
			});
		});

		return {
			window: g_window,
			tab: dt_created,
		};
	}
	// cannot create windows
	else {
		return await new Promise((fk_resolve) => {
			chrome.tabs.create({
				url: p_url,
			}, (dt_created) => {
				fk_resolve({
					window: null,
					tab: dt_created,
				});
			});
		});
	}
}
