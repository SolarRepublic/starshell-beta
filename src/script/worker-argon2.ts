declare var self: DedicatedWorkerGlobalScope;

import type {Vocab} from "#/meta/vocab";
import type * as Argon2Imports from "#/crypto/argon2";
import type {Workers} from "./messages";

(function() {
	const {Argon2} = inline_require('#/crypto/argon2') as typeof Argon2Imports;

	self.onmessage = async function(d_event_init) {
		if('init' === d_event_init.data.type) {
			const d_worker = self as unknown as Vocab.TypedWorker<Workers.Argon2ToHost, Workers.HostToArgon2>;

			d_worker.onmessage = async(d_event) => {
				const {
					type: si_type,
					id: si_request,
					value: w_value,
				} = d_event.data;

				if('hash' === si_type) {
					// run hash algo
					let atu8_hash: Uint8Array;
					try {
						atu8_hash = await Argon2.hash(w_value as Argon2Imports.Argon2Config);
					}
					catch(e_hash) {
						self.postMessage({
							type: 'error',
							id: si_request,
							value: e_hash.message,
						});

						return;
					}

					// send success response
					self.postMessage({
						type: 'ok',
						id: si_request,
						value: atu8_hash,
					}, [atu8_hash.buffer]);
				}
			};

			self.postMessage({
				type: 'ack',
			});
		}
	}
})();
