import type {Promisable} from '#/meta/belt';

export interface ErrorReport {
	title: string;
	text?: string;
	error?: Error;
}

export interface WarnReport {
	title: string;
	text: string;
}


// running log of reported errors
const a_errors: ErrorReport[] = [];

// error listener
type ErrorCallback = (g_report: ErrorReport) => Promisable<void>;

const a_error_listeners: ErrorCallback[] = [];

export function on_error(fe_report: ErrorCallback): VoidFunction {
	a_error_listeners.push(fe_report);

	const fk_remove = () => {
		const i_listener = a_error_listeners.indexOf(fe_report);
		a_error_listeners.splice(i_listener, 1);
	};

	return fk_remove;
}



export function syserr(z_error: Error | ErrorReport): Error {
	let g_error = z_error as ErrorReport;

	if(z_error instanceof Error) {
		g_error = {
			error: z_error,
			title: z_error['title'] || `Runtime error: ${z_error.name}`,
			text: z_error['message'],
		};
	}

	// prevent redundant errors
	const si_error = JSON.stringify(g_error);
	if(!a_errors.find(g => si_error === JSON.stringify(g))) {
		a_errors.push(g_error);

		for(const fk_listener of a_error_listeners) {
			void fk_listener(g_error);
		}
	}

	return g_error.error || new Error(g_error.text);
}

export function syswarn(g_warn: WarnReport): void {
	console.warn(g_warn);
}
