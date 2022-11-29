import {B_FIREFOX_ANDROID, NL_DATA_ICON_MAX, R_DATA_IMAGE_URL_WEB} from '#/share/constants';
import {timeout_exec} from '#/util/belt';

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
let dm_canvas_shared: HTMLCanvasElement | null = null;
let d_2d_shared: CanvasRenderingContext2D | null = null;

function prepare_canvas(): boolean {
	// already attempted to load 2d context and failed
	if(dm_canvas_shared && !d_2d_shared) return false;

	// haven't tried creating 2d context yet; prep canvas and 2d context
	if(!dm_canvas_shared) {
		dm_canvas_shared = document.createElement('canvas');
		d_2d_shared = dm_canvas_shared.getContext('2d');
	}

	// 2d context is not available; skip render icon
	if(!d_2d_shared) return false;

	// success
	return true;
}

/**
 * Renders the given image element into a data URL
 */
export function render_icon_data(
	d_img: HTMLImageElement,
	npx_dim_dst=256,
	fk_init?: (d_2d: CanvasRenderingContext2D, dm_canvas: HTMLCanvasElement) => void,
	sx_media_type: string | null=null
): string | undefined {
	// canvas or rendering unavailable
	if(!prepare_canvas()) return;

	// ref objects
	const dm_canvas = dm_canvas_shared!;
	const d_2d = d_2d_shared!;

	// resize canvas
	dm_canvas.width = dm_canvas.height = npx_dim_dst;

	// clear background
	d_2d.clearRect(0, 0, dm_canvas.width, dm_canvas.height);

	// init callback
	fk_init?.(d_2d, dm_canvas);

	// image is svg; work around annoying intrinsic size canvas interaction
	if(sx_media_type?.startsWith('image/svg')) {
		d_2d.drawImage(d_img, 0, 0, npx_dim_dst, npx_dim_dst);
	}
	// draw image to canvas, centered along both axes
	else {
		const npx_src_w = d_img.naturalWidth;
		const npx_src_h = d_img.naturalHeight;

		const npx_src_dim = Math.min(npx_src_w, npx_src_h);
		const npx_src_semidim = npx_src_dim / 2;

		const npx_src_x = (npx_src_w / 2) - npx_src_semidim;
		const npx_src_y = (npx_src_h / 2) - npx_src_semidim;

		d_2d.drawImage(d_img, npx_src_x, npx_src_y, npx_src_dim, npx_src_dim, 0, 0, npx_dim_dst, npx_dim_dst);
	}

	// render data url
	const sx_data = B_FIREFOX_ANDROID? dm_canvas.toDataURL('image/png', 1): dm_canvas.toDataURL('image/webp', 1);

	// data URL is invalid or too large; don't use it
	if(!R_DATA_IMAGE_URL_WEB.test(sx_data) || sx_data.length > NL_DATA_ICON_MAX) {
		console.warn(`StarShell is rejecting data URL since it does not meet requirements`);
		return;
	}

	return sx_data;
}


/**
 * Loads the given image URL and generates a data URL
 */
export async function load_icon_data(p_image: string, n_px_dim=256): Promise<string | undefined> {
	// canvas or rendering unavailable
	if(!prepare_canvas()) return;

	// prep image element
	const d_img = new Image();
	d_img.crossOrigin = '';

	// wait for it to load
	d_img.loading = 'eager';

	// attempt to load the icon
	try {
		const [, b_timed_out] = await timeout_exec(XT_TIMEOUT_LOAD_ICON, () => new Promise((fk_resolve, fe_reject) => {
			// image failed to load
			d_img.addEventListener('error', (e_load) => {
				// print error
				console.error(e_load);

				// print informative error and reject promise
				const s_error = `StarShell encountered an error while trying to load icon <${p_image}>. Is the URL correct?`;
				fe_reject(new Error(s_error));
			});

			// image loaded successfully
			d_img.addEventListener('load', () => {
				// verbose
				console.debug(`📥 StarShell loaded icon from application <${p_image}>`);

				// resolve promise
				fk_resolve(void 0);
			}, false);

			// begin loading
			d_img.src = p_image;
		}));

		if(b_timed_out) {
			throw new Error(`StarShell waited more than ${Math.round(XT_TIMEOUT_LOAD_ICON / 1e3)}s for icon to load <${p_image}>`);
		}
	}
	// load error or did not load in time; jump to end
	catch(e_load) {
		console.error(e_load);
		return;
	}

	// attempt to get media type
	let sx_media_type: string | null = null;
	try {
		sx_media_type = (await fetch(d_img.src, {
			method: 'HEAD',
			// cache: 'only-if-cached',
		})).headers.get('Content-Type');
	}
	catch(e_fetch) {
		console.warn(e_fetch);
	}

	return render_icon_data(d_img, n_px_dim, (d_2d) => {
		// fill canvas with destination background color
		d_2d.fillStyle = '#000000';
		d_2d.fillRect(0, 0, n_px_dim, n_px_dim);
	}, sx_media_type);
}
