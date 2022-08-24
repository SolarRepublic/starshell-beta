import type * as Utils from './utils';

console.log(`StarShell.ics-launch: Launched on <${location.href}>`);

(function() {
	const {
		locate_script,
	} = inline_require('./utils.ts') as typeof Utils;

	const {G_USERAGENT} = inline_require('#/share/constants.ts');

	const {qs, dd} = inline_require('#/util/dom.ts');

	const h_query = Object.fromEntries([...new URLSearchParams(location.search.slice(1))]);

	const b_setup = 'setup' in h_query;
	const b_pwa = 'pwa' in h_query;

	let b_started = false;

	function startup() {
		if(b_started) return;

		b_started = true;

		const dm_body = document.body;

		dm_body.style = 'margin: 0;';

		if(b_setup) {
			history.pushState({}, '', 'https://launch.starshell.net/');

			const dm_main = document.querySelector('main')!;

			let si_setup = '';

			if('Android' === G_USERAGENT.os.name) {
				if('Firefox' === G_USERAGENT.browser.name) {
					si_setup = 'firefox';
				}
			}
			else if('iOS' === G_USERAGENT.os.name) {
				if('iPhone' === G_USERAGENT.device.model) {
					si_setup = 'iphone';
				}
			}

			if(si_setup) {
				dm_main.innerHTML = '';
				const dm_setup = document.getElementById(`setup-${si_setup}`)!;
				dm_main.appendChild(dm_setup);
			}
		}
		// pwa
		else if(b_pwa) {
			dm_body.innerHTML = '';

			const dm_iframe = dd('iframe', {
				src: chrome.runtime.getURL('src/entry/popup.html'),
				style: `
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					margin: 0;
					padding: 0;
					border: none;
				`,
			});

			document.body.appendChild(dm_iframe);
		}
		// launching app
		else {
			location.href = chrome.runtime.getURL('src/entry/popup.html');
		}
	}

	window.addEventListener('DOMContentLoaded', startup);

	setTimeout(startup, 250e3);
	setTimeout(startup, 500e3);
	setTimeout(startup, 1e3);
	setTimeout(startup, 2e3);
})();
