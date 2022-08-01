import type { Dict, JsonObject, JsonValue } from "#/util/belt";
import type { Compute } from "ts-toolbelt/out/Any/Compute";
import type { HostToRelay, RelayToHost } from "#/script/messages";
import type { Vocab } from "#/meta/vocab";
import { StorageModule } from "./storage-module";
import { HotWalletModule } from "./host-wallet-module";


/**
 * Declare and export the connnection handle options expected.
 */
export interface ConnectionHandleConfig extends JsonObject {
	features: Dict<JsonObject>;
}


/**
 * Enable type-checking for inline on calls to `postMessage()` and the `.onmessage` handler
 */
type RelayToHostConnectionPort = Compute<Vocab.TypedPort<RelayToHost.ConnectionVocab>>;


interface QueryModule {

}




const h_handlers: Vocab.Handlers<HostToRelay.ConnectionVocab> = {
	// host is responding to a specific action
	respondAction(g_respond) {
		// ref the response index (correlates to outgoing `count`)
		const i_msg = g_respond.index;

		// lookup the callback
		const fk_respond = this._h_callbacks[i_msg+''];

		// no such callback
		if(!fk_respond) {
			return console.error(`Received action response but no callback was found at index ${i_msg}`);
		}

		// delete the callback from the dict
		delete this._h_callbacks[i_msg+''];

		// execute the callback with the response value
		fk_respond(g_respond.result);
	},

	// host is emitting some event
	emitEvent(g_event) {

	},
};


export class ConnectionChannel {
	protected _c_msgs = 0;
	protected _h_callbacks: Dict<(w_value: JsonValue) => void | Promise<void>>;

	constructor(protected _d_port: RelayToHostConnectionPort) {
		_d_port.onmessage = (d_event) => {
			// destructure message data
			const {
				type: si_type,
				value: w_value,
			} = d_event.data;

			// ref handler
			const f_handler = h_handlers[si_type];
			if(!f_handler) {
				console.error(`Received message having an unregistered type "${si_type}"`);
				return;
			}

			// handler is registered; execute it
			console.debug(`Received connection port message having registered type %o`, d_event.data);
			f_handler.call(this, w_value);
		};
	}

	async submit<
		// infer message type from argument
		si_msg extends keyof RelayToHost.ConnectionVocab,
		// infer message value from message type
		w_value extends Vocab.MessageValue<RelayToHost.ConnectionVocab, si_msg>,
		// infer response type from message type
		w_response extends Vocab.Response<RelayToHost.ConnectionVocab>,
	>(si_msg: si_msg, w_value?: w_value): Promise<w_response> {
		// create message index
		const i_msg = this._c_msgs++;

		// go async
		return new Promise((fk_resolve) => {
			// subscribe to response
			this._h_callbacks[i_msg+''] = fk_resolve as (w: JsonValue) => void;

			// post
			this._d_port.postMessage({
				type: si_msg,
				value: (w_value ?? null) as any,
				count: i_msg,
			});
		});
	}

	async uploadStore(h_store: Dict): Promise<void> {
		await this.submit('uploadStore', h_store);
	}

	async lockStore(): Promise<void> {
		await this.submit('lockStore');
	}

	async releaseStore(): Promise<void> {
		await this.submit('releaseStore');
	}

	async downloadStore(): Promise<Dict> {
		return await this.submit('downloadStore');
	}
}



interface HandleFields {
	k_channel: ConnectionChannel;
	c_comands: number;
	km_storage: StorageModule | null;
	km_hotwallet: HotWalletModule | null;
}

const hm_fields = new WeakMap<ConnectionHandle, HandleFields>();

export class ConnectionHandle {
	static async create(si_handle: string, gc_handle: ConnectionHandleConfig, d_port: MessagePort): Promise<ConnectionHandle> {
		// create instance
		const k_handle = new ConnectionHandle(si_handle, gc_handle, d_port);

		// fetch private fields
		const g_fields = hm_fields.get(k_handle)!;

		// init modules
		const [
			km_storage,
			km_hotwallet,
		] = await Promise.all([
			// storage
			(async() => {
				// storage is enabled
				if(gc_handle.features.storage) {
					// init storage
					return StorageModule.create(k_handle, g_fields.k_channel);
				}

				// storage is not enabled
				return null;
			})(),

			// hot wallet
			(async() => {
				// storage is enabled
				if(gc_handle.features.hotWallet) {
					// init storage
					return StorageModule.create(k_handle, g_fields.k_channel);
				}

				// storage is not enabled
				return null;
			})(),

		]);

		// update modules
		Object.assign(g_fields, {
			km_storage,
			km_hotwallet,
		});

		// return instance
		return k_handle;
	}

	// not for public use
	private constructor(si_handle: string, gc_handle: ConnectionHandleConfig, d_port: MessagePort) {
		const k_channel = new ConnectionChannel(d_port);

		hm_fields.set(this, {
			k_channel: k_channel,
			c_comands: 0,
			km_storage: null,
			km_hotwallet: null,
		});
	}


	/**
	 * Fetch the storage module for this connection
	 */
	get storage(): StorageModule | null {
		return hm_fields.get(this)!.km_storage;
	}


	/**
	 * Fetch the hot wallet module for this connection
	 */
	get hotWallet(): HotWalletModule | null {
		return hm_fields.get(this)!.km_hotwallet;
	}
}
