import type {
	AppToSpotter,
	IcsToService,
} from './messages';

import type { Vocab } from '#/meta/vocab';

/**
 * The spotter's sole purpose is to silently forward advertisement requests from the page to the service.
 */
(function() {
	// ref and cast runtime
	const d_runtime: Vocab.TypedRuntime<IcsToService.PublicVocab> = chrome.runtime;

	// verbose
	const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.ics-spotter: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	// prep handler map
	const h_handlers_window: Vocab.Handlers<AppToSpotter.WindowVocab> = {
		// window is requesting advertismement
		async requestAdvertisement() {
			// verbose
			debug('Processing #requestAdvertisement');

			// let service worker decide what to do
			await d_runtime.sendMessage({
				type: 'requestAdvertisement',
			});
		},
	};

	// start listening for messages
	(window as Vocab.TypedWindow<AppToSpotter.WindowVocab>).addEventListener('message', (d_event) => {
		// verbose
		debug('Observed window message %o', d_event);

		// originates from same frame
		if(window === d_event.source) {
			// access event data
			const z_data = d_event.data;

			// data item conforms
			let si_type;
			if(z_data && 'object' === typeof z_data && 'string' === typeof (si_type=z_data.type)) {
				// ref handler
				const f_handler = h_handlers_window[si_type];

				// ignore all other messages
				if(!f_handler) return;

				// handler is registered; execute it
				debug(`Received relay port message having registered type %o`, d_event.data);
				f_handler(z_data);
			}
		}
	});
})();
