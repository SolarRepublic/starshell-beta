import type {
	Keplr as KeplrInterface,
} from '@keplr-wallet/types';

import type * as KeplrWalletProvider from '@keplr-wallet/provider';
// import {Keplr} from '@keplr-wallet/provider';
import {Dict, microtask, ode} from '#/util/belt';
import type * as Belt from '#/util/belt';

import {InjectedKeplr as dc_keplr} from './injected-keplr';

// verbose
const debug = (s: string, ...a_args: any[]) => console.debug(`StarShell.mcs-keplr: ${s}`, ...a_args);
debug(`Launched on <${location.href}>`);

(function() {
	// const {
	// 	microtask,
	// 	ode,
	// } = inline_require('#/util/belt.ts') as typeof Belt;
	// debugger;
	// const {InjectedKeplr} = inline_require('@keplr-wallet/provider') as typeof KeplrWalletProvider;

	function proxy_def(y_keplr: KeplrInterface, h_defs: Dict<(f_original: Function, a_args: any[]) => any>) {
		for(const [si_property, z_replace] of ode(h_defs)) {
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

	// if(true) {
	/* eslint-disable */
	// @ts-expect-error keplr polyfill
	// const dc_keplr = class{constructor(t,e,r={addMessageListener:t=>window.addEventListener("message",t),removeMessageListener:t=>window.removeEventListener("message",t),postMessage:t=>window.postMessage(t,window.location.origin)},n){this.version=t,this.mode=e,this.eventListener=r,this.parseMessage=n,this.enigmaUtils=new Map,this.defaultOptions={}}static startProxy(t,e={addMessageListener:t=>window.addEventListener("message",t),postMessage:t=>window.postMessage(t,window.location.origin)},r){e.addMessageListener(i=>n(this,void 0,void 0,(function*(){const o=r?r(i.data):i.data;if(o&&"proxy-request"===o.type)try{if(!o.id)throw new Error("Empty id");if("version"===o.method)throw new Error("Version is not function");if("mode"===o.method)throw new Error("Mode is not function");if("defaultOptions"===o.method)throw new Error("DefaultOptions is not function");if(!t[o.method]||"function"!=typeof t[o.method])throw new Error("Invalid method: "+o.method);if("getOfflineSigner"===o.method)throw new Error("GetOfflineSigner method can\'t be proxy request");if("getOfflineSignerOnlyAmino"===o.method)throw new Error("GetOfflineSignerOnlyAmino method can\'t be proxy request");if("getOfflineSignerAuto"===o.method)throw new Error("GetOfflineSignerAuto method can\'t be proxy request");if("getEnigmaUtils"===o.method)throw new Error("GetEnigmaUtils method can\'t be proxy request");const r="signDirect"===o.method?yield(()=>n(this,void 0,void 0,(function*(){const e=o.args[2],r=yield t.signDirect(o.args[0],o.args[1],{bodyBytes:e.bodyBytes,authInfoBytes:e.authInfoBytes,chainId:e.chainId,accountNumber:e.accountNumber?a.default.fromString(e.accountNumber):null},o.args[3]);return{signed:{bodyBytes:r.signed.bodyBytes,authInfoBytes:r.signed.authInfoBytes,chainId:r.signed.chainId,accountNumber:r.signed.accountNumber.toString()},signature:r.signature}})))():yield t[o.method](...s.JSONUint8Array.unwrap(o.args)),i={type:"proxy-request-response",id:o.id,result:{return:s.JSONUint8Array.wrap(r)}};e.postMessage(i)}catch(t){const r={type:"proxy-request-response",id:o.id,result:{error:t.message||t.toString()}};e.postMessage(r)}})))}requestMethod(t,e){const r=new Uint8Array(8),n=Array.from(crypto.getRandomValues(r)).map(t=>t.toString(16)).join(""),i={type:"proxy-request",id:n,method:t,args:s.JSONUint8Array.wrap(e)};return new Promise((t,e)=>{const r=i=>{const o=this.parseMessage?this.parseMessage(i.data):i.data;if(!o||"proxy-request-response"!==o.type)return;if(o.id!==n)return;this.eventListener.removeMessageListener(r);const u=s.JSONUint8Array.unwrap(o.result);u?u.error?e(new Error(u.error)):t(u.return):e(new Error("Result is null"))};this.eventListener.addMessageListener(r),this.eventListener.postMessage(i)})}enable(t){return n(this,void 0,void 0,(function*(){yield this.requestMethod("enable",[t])}))}experimentalSuggestChain(t){var e,r;return n(this,void 0,void 0,(function*(){((null===(e=t.features)||void 0===e?void 0:e.includes("stargate"))||(null===(r=t.features)||void 0===r?void 0:r.includes("no-legacy-stdTx")))&&console.log("“stargate”, “no-legacy-stdTx” feature has been deprecated. The launchpad is no longer supported, thus works without the two features. We would keep the aforementioned two feature for a while, but the upcoming update would potentially cause errors. Remove the two feature."),yield this.requestMethod("experimentalSuggestChain",[t])}))}getKey(t){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("getKey",[t])}))}sendTx(t,e,r){return n(this,void 0,void 0,(function*(){return"length"in e||console.log("Do not send legacy std tx via `sendTx` API. We now only support protobuf tx. The usage of legeacy std tx would throw an error in the near future."),yield this.requestMethod("sendTx",[t,e,r])}))}signAmino(t,e,r,i={}){var s;return n(this,void 0,void 0,(function*(){return yield this.requestMethod("signAmino",[t,e,r,h.default(null!==(s=this.defaultOptions.sign)&&void 0!==s?s:{},i)])}))}signDirect(t,e,r,i={}){var s;return n(this,void 0,void 0,(function*(){const n=yield this.requestMethod("signDirect",[t,e,{bodyBytes:r.bodyBytes,authInfoBytes:r.authInfoBytes,chainId:r.chainId,accountNumber:r.accountNumber?r.accountNumber.toString():null},h.default(null!==(s=this.defaultOptions.sign)&&void 0!==s?s:{},i)]),o=n.signed;return{signed:{bodyBytes:o.bodyBytes,authInfoBytes:o.authInfoBytes,chainId:o.chainId,accountNumber:a.default.fromString(o.accountNumber)},signature:n.signature}}))}signArbitrary(t,e,r){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("signArbitrary",[t,e,r])}))}verifyArbitrary(t,e,r,i){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("verifyArbitrary",[t,e,r,i])}))}signEthereum(t,e,r,i){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("signEthereum",[t,e,r,i])}))}getOfflineSigner(t){return new u.CosmJSOfflineSigner(t,this)}getOfflineSignerOnlyAmino(t){return new u.CosmJSOfflineSignerOnlyAmino(t,this)}getOfflineSignerAuto(t){return n(this,void 0,void 0,(function*(){return(yield this.getKey(t)).isNanoLedger?new u.CosmJSOfflineSignerOnlyAmino(t,this):new u.CosmJSOfflineSigner(t,this)}))}suggestToken(t,e,r){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("suggestToken",[t,e,r])}))}getSecret20ViewingKey(t,e){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("getSecret20ViewingKey",[t,e])}))}getEnigmaPubKey(t){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("getEnigmaPubKey",[t])}))}getEnigmaTxEncryptionKey(t,e){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("getEnigmaTxEncryptionKey",[t,e])}))}enigmaEncrypt(t,e,r){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("enigmaEncrypt",[t,e,r])}))}enigmaDecrypt(t,e,r){return n(this,void 0,void 0,(function*(){return yield this.requestMethod("enigmaDecrypt",[t,e,r])}))}getEnigmaUtils(t){if(this.enigmaUtils.has(t))return this.enigmaUtils.get(t);const e=new o.KeplrEnigmaUtils(t,this);return this.enigmaUtils.set(t,e),e}};
	// const dc_keplr = Keplr;
	/* eslint-enable */


	// const dc_keplr = InjectedKeplr;

	const keplr = new dc_keplr('0.10.19', 'extension') as unknown as KeplrInterface;

	// proxy_def(keplr, {
	// 	async enable(f_original, a_args): Promise<void> {
	// 		debug(`intercepted keplr::enable(%o)`, a_args);

	// 		await microtask();

	// 		const [z_chains] = a_args;

	// 		if('string' === typeof z_chains) {
	// 			return;
	// 		}
	// 		else if(Array.isArray(z_chains)) {
	// 			return;
	// 		}

	// 		// let keplr throw the error
	// 		return f_original(...a_args);
	// 	},

	// 	experimentalSuggestChain(f_original, a_args) {
	// 		debug(`intercepted keplr::experimentalSuggestChain(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	getKey(f_original, a_args) {
	// 		debug(`intercepted keplr::getKey(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	sendTx(f_original, a_args) {
	// 		debug(`intercepted keplr::sendTx(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	signAmino(f_original, a_args) {
	// 		debug(`intercepted keplr::signAmino(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	signDirect(f_original, a_args) {
	// 		debug(`intercepted keplr::signDirect(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	signArbitrary(f_original, a_args) {
	// 		debug(`intercepted keplr::signArbitrary(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	verifyArbitrary(f_original, a_args) {
	// 		debug(`intercepted keplr::verifyArbitrary(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	signEthereum(f_original, a_args) {
	// 		debug(`intercepted keplr::signEthereum(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	getOfflineSigner(f_original, a_args) {
	// 		debug(`intercepted keplr::getOfflineSigner(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	getOfflineSignerOnlyAmino(f_original, a_args) {
	// 		debug(`intercepted keplr::getOfflineSignerOnlyAmino(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	getOfflineSignerAuto(f_original, a_args) {
	// 		debug(`intercepted keplr::getOfflineSignerAuto(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	suggestToken(f_original, a_args) {
	// 		debug(`intercepted keplr::suggestToken(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	getSecret20ViewingKey(f_original, a_args) {
	// 		debug(`intercepted keplr::getSecret20ViewingKey(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	getEnigmaPubKey(f_original, a_args) {
	// 		debug(`intercepted keplr::getEnigmaPubKey(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	getEnigmaTxEncryptionKey(f_original, a_args) {
	// 		debug(`intercepted keplr::getEnigmaTxEncryptionKey(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	enigmaEncrypt(f_original, a_args) {
	// 		debug(`intercepted keplr::enigmaEncrypt(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	enigmaDecrypt(f_original, a_args) {
	// 		debug(`intercepted keplr::enigmaDecrypt(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// 	getEnigmaUtils(f_original, a_args) {
	// 		debug(`intercepted keplr::getEnigmaUtils(%o)`, a_args);

	// 		return f_original(...a_args);
	// 	},
	// });

	if(!window.keplr) {
		window.keplr = keplr;

		window.getOfflineSigner = (chainId: string) => keplr.getOfflineSigner(chainId);
		window.getOfflineSignerOnlyAmino = (chainId: string) => keplr.getOfflineSignerOnlyAmino(chainId);
		window.getOfflineSignerAuto = (chainId: string) => keplr.getOfflineSignerAuto(chainId);
		window.getEnigmaUtils = (chainId: string) => keplr.getEnigmaUtils(chainId);

		console.log('added ', window.keplr);
	}
	else {
		console.log('already installed ', window.keplr);
	}
	// }
})();