import {NL_DATA_ICON_MAX, R_DATA_IMAGE_URL_WEB} from '#/share/constants';

/**
 * Locate a script asset in the extension bundle by its path prefix.
 * @param s_pattern the path prefix
 * @returns fully qualified URL to the asset, or `null` if not found
 */
export function locate_script(s_pattern: string): null | string {
	const g_manifest = chrome.runtime.getManifest();

	// each content script entry
	for(const g_script of g_manifest.content_scripts || []) {
		for(const sr_script of g_script.js ?? []) {
			if(sr_script.startsWith(s_pattern)) {
				return sr_script;
			}
		}
	}

	// each web accessible resource
	for(const z_resource of g_manifest.web_accessible_resources || []) {
		// in manifest v2
		if('string' === typeof z_resource) {
			if(z_resource.startsWith(s_pattern)) {
				return z_resource;
			}
		}
		// in manifest v3
		else {
			for(const sr_script of z_resource.resources) {
				if(sr_script.startsWith(s_pattern)) {
					return sr_script;
				}
			}
		}
	}

	return null;
}



// timeout duration for loading icon
const XT_TIMEOUT_LOAD_ICON = 4e3;

// reusable canvas 2d context
let dm_canvas: HTMLCanvasElement | null = null;
let d_2d: CanvasRenderingContext2D | null = null;

export async function load_icon_data(p_image: string, n_px_dim=256): Promise<string | undefined> {
	// already attempted to load 2d context and failed
	if(dm_canvas && !d_2d) return;

	// haven't tried creating 2d context yet; prep canvas and 2d context
	if(!dm_canvas) {
		dm_canvas = document.createElement('canvas');
		d_2d = dm_canvas.getContext('2d');
	}

	// 2d context is not available; skip load icon
	if(!d_2d) return;

	// resize canvas
	dm_canvas.width = dm_canvas.height = n_px_dim;

	// prep image element
	const d_img = new Image(n_px_dim, n_px_dim);
	d_img.crossOrigin = '';

	// wait for it to load
	d_img.loading = 'eager';

	// attempt to load the icon
	try {
		// wait for it to load
		await new Promise((fk_resolve, fe_reject) => {
			// timeout error
			const i_timeout = setTimeout(() => {
				// print error and reject promise
				const s_error = `StarShell waited more than ${Math.round(XT_TIMEOUT_LOAD_ICON / 1e3)}s for icon to load <${p_image}>`;
				console.error(s_error);
				fe_reject(new Error(s_error));
			}, XT_TIMEOUT_LOAD_ICON);

			// image failed to load
			d_img.addEventListener('error', (e_load) => {
				// cancel timeout
				clearTimeout(i_timeout);

				// print error
				console.error(e_load);

				// print informative error and reject promise
				const s_error = `StarShell received an error while trying to load icon <${p_image}>. Is the URL correct?`;
				console.error(s_error);
				fe_reject(new Error(s_error));
			});

			// image loaded successfully
			d_img.addEventListener('load', () => {
				// verbose
				console.log(`StarShell successfully loaded application icon <${p_image}>`)

				// cancel timeout
				clearTimeout(i_timeout);

				// resolve promise
				fk_resolve(void 0);
			}, false);

			// begin loading
			d_img.src = p_image;
		});
	}
	// load error or did not load in time; jump to end
	catch(e_load) {
		return;
	}

	// fill canvas with destination background color
	d_2d.fillStyle = '#000000';
	d_2d.fillRect(0, 0, n_px_dim, n_px_dim);

	// draw to canvas
	d_2d.drawImage(d_img, 0, 0, n_px_dim, n_px_dim);

	// render data url
	const sx_data = dm_canvas.toDataURL('image/webp', 1);

	// data URL is invalid or too large; don't use it
	if(!R_DATA_IMAGE_URL_WEB.test(sx_data) || sx_data.length > NL_DATA_ICON_MAX) {
		console.debug(`StarShell is rejecting data URL since it does not meet requirements`);
		return;
	}

	return sx_data;
}
