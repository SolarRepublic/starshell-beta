import RuntimeKey from './runtime-key';
import SensitiveBytes from './sensitive-bytes';

export function generateSoftWalletRootKey(): Promise<RuntimeKey> {
	return RuntimeKey.create(() => SensitiveBytes.random(32).data);
}
