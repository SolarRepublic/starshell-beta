import type {
	Keplr as KeplrStruct,
} from '@keplr-wallet/types';

import type {Dict} from '#/meta/belt';
import type * as UtilBelt from '#/util/belt';

import type * as InjectedKeplrImport from './injected-keplr';
import type {Vocab} from '#/meta/vocab';
import type {WitnessToKeplr} from './messages';

(function() {
	const {
		InjectedKeplr: dc_keplr,
	} = inline_require('./injected-keplr.ts') as typeof InjectedKeplrImport;

	// verbose
	const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.mcs-keplr: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	function proxy_def(y_keplr: KeplrStruct, h_defs: Dict<(f_original: Function, a_args: any[]) => any>) {
		for(const [si_property, z_replace] of Object.entries(h_defs)) {
			// ref original property value
			const z_original = y_keplr[si_property];

			// function
			if('function' === typeof z_original) {
				// replace with proxy
				y_keplr[si_property] = new Proxy(z_original, {
					apply(f_target, w_this, a_args) {
						return (z_replace as Function).apply(w_this, [z_original, a_args]);
					},
				});
			}
		}
	}

	// // handle commands from isolated world
	// (chrome.runtime as Vocab.TypedRuntime<WitnessToKeplr>).onMessage.addListener((g_msg) => {
	// 	if('hardenExport' === g_msg.type) {

	// 	}
	// });

	// @ts-expect-error intentional undercall
	const keplr = new dc_keplr('0.10.24', 'extension') as unknown as KeplrStruct;

	if(!window.keplr) {
		window.keplr = keplr;

		window.getOfflineSigner = (chainId: string) => keplr.getOfflineSigner(chainId);
		window.getOfflineSignerOnlyAmino = (chainId: string) => keplr.getOfflineSignerOnlyAmino(chainId);
		window.getOfflineSignerAuto = (chainId: string) => keplr.getOfflineSignerAuto(chainId);
		window.getEnigmaUtils = (chainId: string) => keplr.getEnigmaUtils(chainId);

		debug('Added ', window.keplr);
	}
	else {
		debug('Keplr API already present ', window.keplr);
	}
})();
