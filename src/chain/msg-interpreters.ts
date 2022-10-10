import {BankMessages} from './messages/bank';
import {ComputeMessages} from './messages/compute';
import {DistributionMessages} from './messages/distribution';
import { GovMessages } from './messages/gov';
import type {MessageDict} from './messages/_types';

export const H_INTERPRETTERS: MessageDict = {
	...BankMessages,
	...ComputeMessages,
	...DistributionMessages,
	...GovMessages,
};
