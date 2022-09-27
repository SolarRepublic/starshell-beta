import type {Union} from 'ts-toolbelt';
import type {JsonValue, Promisable} from '#/meta/belt';
import type {Vocab} from '#/meta/vocab';
import type {IntraExt} from './messages';

const d_broadcast_global: Vocab.TypedBroadcast<IntraExt.GlobalVocab> = new BroadcastChannel('global');


/**
 * Broadcast a message on the global broadcast channel
 */
export function global_broadcast(g_msg: Vocab.Message<IntraExt.GlobalVocab>): void {
	// broadcast out
	d_broadcast_global.postMessage(g_msg);

	// echo locally
	d_broadcast_global.dispatchEvent(new MessageEvent('message', {
		data: g_msg,
	}));
}


/**
 * Register a set of event handlers on the global broadcast channel
 */
export function global_receive(h_handlers: Partial<Vocab.Handlers<IntraExt.GlobalVocab>>): VoidFunction {
	// create listener
	const f_listener: Vocab.BroadcastListener<IntraExt.GlobalVocab> = (d_event) => {
		// ref message data
		const g_msg = d_event.data as typeof d_event.data | null | {type: undefined};

		// invalid event data
		if(!g_msg || !g_msg.type) {
			throw new Error('Ignored invalid message received on global broadcast channel');
		}

		// destructure message
		const {
			type: si_type,
			value: w_value=null,
		} = g_msg as Union.Strict<typeof g_msg>;

		// locate handler
		const f_handler = h_handlers[si_type];

		// not handled, ignore
		if(!f_handler) return;

		// handle
		void (f_handler as (w_value: JsonValue) => Promisable<void>)(w_value);
	};

	// add listener
	d_broadcast_global.addEventListener('message', f_listener);

	// return remover function
	return () => {
		d_broadcast_global.removeEventListener('message', f_listener);
	};
}

/**
 * Listens for specific message on global broadcast channel and unregisters on first successful delivery
 */
export async function global_wait<
	si_key extends keyof IntraExt.GlobalVocab,
>(
	si_key: si_key,
	fk_test: (w_value: Vocab.MessageValue<IntraExt.GlobalVocab, si_key>) => Promisable<boolean> = () => true,
	xt_timeout=0
): Promise<void> {
	// capture stack trace
	const s_stack = (new Error()).stack || '';

	// go async
	return new Promise((fk_resolve, fe_reject) => {
		// prep timeout id
		let i_timeout = 0;

		// receive messages
		const f_unregister = global_receive({
			[si_key]: (w_value) => {
				// call tester; truthy return means to unregister
				if(fk_test(w_value as Vocab.MessageValue<IntraExt.GlobalVocab, si_key>)) {
					// unregister listener
					f_unregister();

					// cancel timeout
					clearTimeout(i_timeout);

					// resolve
					fk_resolve();
				}
			},
		});

		// a timeout value was provided
		if(Number.isInteger(xt_timeout) && xt_timeout > 0) {
			// set a cancel timeout
			i_timeout = (globalThis as typeof window).setTimeout(() => {
				// unregister
				f_unregister();

				// not good
				fe_reject(new Error(`A timeout was reached waiting for the '${si_key}' event\n${s_stack}`));
			}, xt_timeout);
		}
	});
}
