<script lang="ts">
	import type {Bech32} from '#/meta/chain';
	
	import {Snip2xMessageConstructor} from '#/schema/snip-2x-const';
	
	import {Screen} from './_screens';
	import {syserr} from '../common';
	import {load_app_context} from '../svelte';
	
	import type {SecretNetwork} from '#/chain/secret-network';
	import {Accounts} from '#/store/accounts';
	import {Contracts} from '#/store/contracts';
	import {Providers} from '#/store/providers';
	
	import RequestSignature from './RequestSignature.svelte';

	const {
		g_chain,
		p_chain,
		p_account,
		k_page,
	} = load_app_context();

	export let bech32s: Bech32[] = [];

	(async function load() {
		if(g_chain?.features.secretwasm) {
			// load structs
			const g_account = await Accounts.at(p_account);

			// instantiate network
			const k_network = await Providers.activateDefaultFor<SecretNetwork>(g_chain);

			// do a quick test
			try {
				await Providers.quickTest(k_network.provider, g_chain);
			}
			catch(e_check) {
				throw syserr(e_check as Error);
			}

			// load contracts
			const ks_contracts = await Contracts.read();

			// generate viewing key messages
			const a_msgs_proto = await Promise.all(bech32s.map(async(sa_bech32) => {
				const g_token = {
					bech32: sa_bech32,
					hash: ks_contracts.at(Contracts.pathFor(p_chain, sa_bech32))?.hash || '',
					chain: p_chain,
				};

				// construct wasm message
				const g_exec = await Snip2xMessageConstructor.generate_viewing_key(g_account!, g_token, k_network);

				// as proto
				return g_exec.proto;
			}));

			k_page.push({
				creator: RequestSignature,
				props: {
					protoMsgs: a_msgs_proto,
					fee: {
						limit: BigInt(g_chain.features.secretwasm.snip20GasLimits.set_viewing_key) * BigInt(a_msgs_proto.length),
					},
					broadcast: true,
				},
			});
		}
	})();
</script>

<style lang="less">
	
</style>

<Screen>

</Screen>
