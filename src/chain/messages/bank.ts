import type {Bech32} from '#/meta/chain';
import type {FieldConfig} from '#/meta/field';
import type {Coin} from '@cosmjs/amino';
import type {MessageDict} from './_types';
import {add_coins} from './_util';

export const BankMessages: MessageDict = {
	'cosmos-sdk/MsgSend'(g_msg, {g_chain}) {
		const {
			from_address: sa_sender,
			to_address: sa_recipient,
			amount: a_coins,
		} = g_msg as unknown as {
			from_address: Bech32;
			to_address: Bech32;
			amount: Coin[];
		};

		const a_fields: FieldConfig[] = [
			{
				type: 'contacts',
				label: 'Recipient',
				bech32s: [sa_recipient],
				g_chain,
			},
		];

		const as_coins = new Set<string>();

		add_coins({
			g_chain,
			coins: a_coins,
			set: as_coins,
		}, a_fields);

		const s_coins = [...as_coins].join(', ');
		return {
			title: `Send ${s_coins}`,
			tooltip: `Sends coins from your account to the designated recipient.`,
			fields: a_fields,
		};
	},

	'cosmos-sdk/MsgMultiSend'(g_msg, {g_chain}) {
		const {
			inputs: a_inputs,
			outputs: a_outputs,
		} = g_msg as unknown as {
			inputs: {
				address: Bech32;
				coins: Coin[];
			}[];
			outputs: {
				address: Bech32;
				coins: Coin[];
			}[];
		};

		const a_fields: FieldConfig[] = [];

		const as_coins = new Set<string>();

		// there are other inputs
		if(a_inputs.length > 1) {
			// each input
			for(let i_input=0, nl_inputs=a_inputs.length; i_input<nl_inputs; i_input++) {
				const {
					address: sa_sender,
					coins: a_coins,
				} = a_inputs[i_input];

				// create subfields
				const a_subfields: FieldConfig[] = [];

				// add contact
				a_subfields.push({
					type: 'contacts',
					label: `Sender #${i_input+1}`,
					bech32s: [sa_sender],
					g_chain,
				});

				add_coins({
					g_chain,
					coins: a_coins,
					label_prefix: '└─ ',
					set: as_coins,
				}, a_subfields);

				// push group
				a_fields.push({
					type: 'group',
					fields: a_subfields,
				});
			}
		}

		// insert gap to break between senders and receivers
		a_fields.push({
			type: 'gap',
		});

		// each output
		for(let i_output=0, nl_outputs=a_outputs.length; i_output<nl_outputs; i_output++) {
			const {
				address: sa_recipient,
				coins: a_coins,
			} = a_outputs[i_output];

			// create subfields
			const a_subfields: FieldConfig[] = [];

			// add contact
			a_subfields.push({
				type: 'contacts',
				label: `Recipient #${i_output+1}`,
				bech32s: [sa_recipient],
				g_chain,
			});

			add_coins({
				g_chain,
				coins: a_coins,
				label_prefix: '└─ ',
				set: as_coins,
			}, a_subfields);

			// push group
			a_fields.push({
				type: 'group',
				fields: a_subfields,
			});
		}

		// insert gap to break end of receivers
		a_fields.push({
			type: 'gap',
		});

		const s_coins = [...as_coins].join(', ');
		return {
			title: `Multi-Send ${s_coins}`,
			tooltip: `Sends coins from the given inputs (which include your account) to the designated recipients.`,
			fields: a_fields,
		};
	},
};
