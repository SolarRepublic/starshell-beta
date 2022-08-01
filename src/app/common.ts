

export interface ErrorReport {
	text?: string;
	error?: Error;
}

export function syserr(g_error: ErrorReport): Error {
	console.error(g_error);
	return g_error.error || new Error(g_error.text);
}

export interface WarnReport {
	text: string;
}

export function syswarn(g_warn: WarnReport): void {
	console.warn(g_warn);
}
