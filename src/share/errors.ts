import type {Resource} from '#/meta/resource';

export class NotAuthenticatedError extends Error {}

export class AlreadyRegisteredError extends Error {}

export class InvalidPassphraseError extends Error {}

export class UnregisteredError extends Error {}

export class RecoverableVaultError extends Error {}

export class CorruptedVaultError extends Error {}

export class ResourceNonExistentError extends Error {
	constructor(p_resource: Resource.Path) {
		super(`The request resource does not exist: ${p_resource}`);
	}
}
