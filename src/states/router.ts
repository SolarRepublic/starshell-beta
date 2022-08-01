import type { Contract } from "#/meta/chain";
import type { Resource } from "#/meta/resource";

type inspect = Resource.Path<Contract>;

/*
There do not seem to be any practical use cases for inversely resolving to a path from the component.

One potential use case would have been for serializing sessions to be restored later (i.e., which
	screens in what order). However, this would require capturing all state information in the URL
	somehow, mapping every property to an identifier. Also, this use case would be a waste of time.

Routing from path to component is useful for search, where each resource has a routable path and a
default representation on screen.

Navigating between screens via user actions is done using direct references to components, not their
paths. Consequently, not all screens need to have a path.

For those resources that are routable, they should be able to inversely resolve to a path in order
to acquire the resource identifier for ...?
they must export a `const` struct from their component definition

*/

export const K_ROUTER = Router.parse({
	'/family.{familyId}': {
		'/account.{pubkey}': {
			// $: ViewAccount,
		},

		'/agent.{pubkey}': {
			// $: ViewAgent

			'/as.contact': {
				// $: ViewContact
			},
		},

		'/chain.{chainId}': {
			// $: ViewChain,

			'/bech32.{addr}': {
				// $: DereferenceAddress,

				'/as.contract': {
					// $: ViewContract,

					'/token.{tokenType}': {
						_tokenType: {
							'snip-20': {
								// $: ViewSnip20,
							},
							'snip-21': {
								// $: ViewSnip21,
							},
							'snip-721': {
								// $: ViewSnip721,
							},
						},
					},
				},

				'/as.agent': {
					// $: ViewAgent,
				},

				'/as.contact': {
					// $: ViewContact,
				},
			},
		},
	},

	'/scheme.{scheme}': {
		'/host.{host}': {
			// $: ViewApp,
		},
	},

	'/media.{mediaType}': {
		'/sha256.{fileHash}': {
			// $: ViewMedia,
		},
	},

});