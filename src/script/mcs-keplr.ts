import type * as InjectedKeplrImport from './injected-keplr';
import type {Keplr as KeplrStruct} from '@keplr-wallet/types';

(function() {
	const {
		InjectedKeplr: dc_keplr,
	} = inline_require('./injected-keplr.ts') as typeof InjectedKeplrImport;

	// verbose
	const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.mcs-keplr: ${s}`, ...a_args);
	debug(`Launched on <${location.href}>`);

	// @ts-expect-error intentional undercall
	const keplr = new dc_keplr('0.11.26', 'extension') as unknown as KeplrStruct;

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
