import type {
	JsonValue,
	JsonObject,
	Dict,
} from '#/util/belt';
import type { BlockInfoHeader, ChainDescriptor, ConnectionManifestV1 } from './common';
import type { Vocab } from '#/meta/vocab';
import type { ConnectionHandleConfig } from '#/provider/connection';
import type { App } from '#/meta/app';
import type { StoreKey } from '#/meta/store';
import type { PromptConfig } from './msg-flow';
import type { Bech32, ChainPath } from '#/meta/chain';
import type { NetworkPath } from '#/meta/network';
import type { IncidentPath, TxConfirmed, TxPending, TxSynced } from '#/meta/incident';


/**
 * Root type for all messages.
 */
export interface TypedMessage<
	s_type extends string=string,
> extends JsonObject {
	type: s_type;
}

export interface DeepLinkMessage extends JsonObject {
	url: string;
}

/**
 * Vocab for wallet events.
 */
export type WalletEvent = Vocab.New<{
	// sent when another page has updated the store
	updateStore: {
		value: Dict;
	};
}>;



/**
 * Messages sent from dApps to spotter
 */
export namespace AppToSpotter {
	/**
	 * Vocab for public messages sent from app to spotter
	 */
	export type WindowVocab = Vocab.New<{
		// request wallet advertisement
		requestAdvertisement: {};
	}>;
}



/**
 * Messages sent from isolated-world content script to service
 */
export namespace IcsToService {
	/**
	 * Vocab for unauthenticated messages sent from isolated-world content script to extension
	 */
	export type PublicVocab = Vocab.New<{
		// forwards the request for an advertisement on the current page
		requestAdvertisement: {
			response: ServiceToIcs.SessionKeys;
		};

		// forwards the request for a new connection on the current page
		requestConnection: {
			value: {
				chains: ChainDescriptor[];
			};
		};

		// signals a security violation from the current page
		panic: {
			value: string;
		};

		// opens a new flow
		flowBroadcast: {
			value: {
				key: string;
				config: PromptConfig;
			};
		};
	}>;


	/**
	 * Vocab for delayed responses (i.e., forward thru background service which may have been killed)
	 */
	export type PublicResponseVocab = Vocab.New<{
		// spawn a flow
		flowBroadcastResponse: {
			value: {
				key: string;
				answer: boolean;
			};
		};
	}>;

}



/**
 * Messages sent from service to isolated-world content script
 */
export namespace ServiceToIcs {
	/**
	 * Delivers session keys
	 */
	export interface SessionKeys extends JsonObject {
		session: string;
	}

}


// /**
//  * Messages sent from service to popup script
//  */
// export namespace ServiceToPopup {
// 	export type TabsVocab = Vocab.New<{
// 		flow: Flow
// 	}>;
// }


/**
 * Messages sent from host to relay
 */
export namespace HostToRelay {
	/**
	 * Format of the JSON payload that gets embedded into the iframe document upon creation
	 */
	export interface Payload extends JsonObject {
		session: string;
		csurl: string;
	}


	/**
	 * Vocab for messages exchanged over authed channel.
	 */
	export type AuthedVocab = Vocab.New<{
		// acknowledges the MessageChannel by sending a message thru it
		acknowledgeChannel: {};

		// responds to a connection request
		respondConnect: {
			value: {
				index: number;
				answer: {
					error: string;
				} | {
					handle: string;
					config: ConnectionHandleConfig;
				};
			};
		};
	}>;



	/**
	 * Vocab for messages exchanged over authed channel.
	 */
	export type ConnectionVocab = Vocab.New<{
		// service is responding to a specific action
		respondAction: {
			value: {
				index: number;
				action: Vocab.Message<RelayToHost.ConnectionVocab>['type'];
				result: JsonValue;
			};
		};

		// service is emitting an event to this page
		emitEvent: {
			value: WalletEvent;
		};
	}>;
}



/**
 * Messages sent from relay to host
 */
export namespace RelayToHost {
	/**
	 * Vocab for messages exchanged over subframe window.
	 */
	export type SubframeVocab = Vocab.New<{
		establishChannel: {};
	}, {
		each: {
			message: {
				auth: string;
			};
		};
	}>;


	/**
	 * Vocab for messages exchanged over authed channel.
	 */
	export type AuthedVocab = Vocab.New<{
		requestConnect: {
			value: {
				index: number;
				manifest: ConnectionManifestV1;
			};
		};
		reportWebsiteError: {
			value: string;
		};
	}>;


	/**
	 * Vocab for messages exchanged over a connection channel.
	 */
	export type ConnectionVocab = Vocab.New<{
		downloadStore: {};
		uploadStore: {
			value: Dict;
			response: Dict;
		};
		putItem: {
			value: string;
		};
		lockStore: {};
		releaseStore: {};
	}, {
		each: {
			message: {
				count: number;
			};
		};
	}>;
}



/**
 * Messages sent from host to ratifier.
 */
export namespace HostToRatifier {
	/**
	 * Vocab for messages exchanged over window.
	 */
	export type WindowVocab = Vocab.New<{
		ratifyGlobal: {};
	}>;
}



/**
 * Messages sent between extension scripts.
 */
export namespace IntraExt {
	/**
	 * Vocab for global broadcasts
	 */
	export type GlobalVocab = Vocab.New<{
		// logged in
		login: {};

		// logout of the application
		logout: {};

		// service heartbeat
		heartbeat: {};

		// wake message
		wake: {};

		// store acquired
		acquireStore: {
			value: {
				key: StoreKey;
			};
		};

		// store released
		releaseStore: {
			value: {
				key: StoreKey;
			};
		};

		// store(s) updated
		updateStore: {
			value: {
				key: StoreKey;
				init: boolean;
			};
		};

		// spawn a flow
		flowBroadcast: {
			value: {
				key: string;
				config: PromptConfig;
			};
		};

		// responde to a flow (in query comm mode)
		flowResponse: {
			value: {
				key: string;
				response: Vocab.Message<FlowResponseVocab>;
			};
		};

		// block info
		blockInfo: {
			value: {
				header: BlockInfoHeader;
				chain: ChainPath;
				network: NetworkPath;
				recents: number[];
				txCount: number;
			};
		};

		// deep link
		deepLink: {
			value: DeepLinkMessage;
		};

		// transfer receive
		transferReceive: {
			value: TxConfirmed | TxSynced;
		};

		// transfer send
		transferSend: {
			value: TxConfirmed | TxSynced;
		};
	}>;


	/**
	 * Vocab for standalone popups that should conduct some specific flow.
	 */
	export type FlowVocab = Vocab.New<{
		// authenticate the user
		authenticate: {};

		// page is requesting advertisement
		requestAdvertisement: {
			value: {
				app: App['interface'];
			};
		};

		// page is requesting a connection
		requestConnection: {
			value: {
				// app: App['interface'];
				chains: ChainDescriptor[];
			};
		};

		// page is requesting to sign transaction
		signTransaction: {
			value: {};
		};

		// user clicked notification
		inspectIncident: {
			value: {
				incident: IncidentPath;
			};
		};

		// QR code scan
		scanQr: {
			value: {
				id: string;
			};
		};

		// deep link
		deepLink: {
			value: DeepLinkMessage;
		};
	}, {
		each: {
			message: {
				page: null | {
					tabId: number;
					href: string;
				};
			};
		};
	}>;


	/**
	 * Vocab for standalone popups that should conduct some specific flow.
	 */
	export type FlowResponseVocab = Vocab.New<{
		// request retransmission
		retransmit: {};

		// acknowledge receipt of a message
		acknowledgeReceipt: {
			value: Vocab.Message<FlowVocab>;
		};

		// indicates the flow was completed
		completeFlow: {
			value: {
				answer: boolean;
			};
		};
	}>;



	/**
	 * Vocab for messages exchanged over window.
	 */
	export type WindowVocab = Vocab.New<{
		conductFlow: {
			value: Vocab.Message<FlowVocab>;
		};
	}>;


	/**
	 * Vocab for instructions to be given directly to service worker.
	 */
	export type ServiceInstruction = Vocab.New<{
		wake: {};

		scheduleFlowResponse: {
			value: {
				key: string;
				response: Vocab.Message<FlowResponseVocab>;
			};
		};

		scheduleBroadcast: {
			value: {
				delay?: number;
				broadcast: Vocab.Message<GlobalVocab>;
			};
		};

		deepLink: {
			value: DeepLinkMessage;
		};

		bankSend: {
			value: {
				network: NetworkPath;
				sender: Bech32.String;
				recipient: Bech32.String;
				coin: string;
				amount: `${bigint}`;
				limit: `${bigint}`;
				price: number;
				memo: string;
			};
		};
	}>;
}


/**
 * Messages sent from web extension to native app.
 */
export namespace ExtToNative {
	/**
	 * Vocab for messages exchanged over window.
	 */
	export type MobileVocab = Vocab.New<{
		greet: {};

		notify: {
			value: {
				title: string;
				message: string;
			};
		};
	}>;
}