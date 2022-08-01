
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
