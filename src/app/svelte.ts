import type {Readable} from 'svelte/store';
import { AppProfile, G_APP_EXTERNAL } from '#/store/apps';
import type {Nameable, Pfpable} from '#/meta/able';
import type {AccountStruct, AccountPath} from '#/meta/account';
import type {AppStruct, AppPath} from '#/meta/app';
import type {ChainStruct, ChainPath, Bech32, ContractStruct} from '#/meta/chain';
import type {Resource} from '#/meta/resource';
import type {ParametricSvelteConstructor} from '#/meta/svelte';
import {ode, ofe} from '#/util/belt';
import {dd} from '#/util/dom';
import {getContext} from 'svelte';
import {cubicOut} from 'svelte/easing';
import type {Page} from '##/nav/page';
import PfpDisplay from './frag/PfpDisplay.svelte';
import {Apps, G_APP_STARSHELL} from '#/store/apps';
import type {IntraExt} from '#/script/messages';
import {SessionStorage} from '#/extension/session-storage';
import {Chains} from '#/store/chains';
import { Contracts } from '#/store/contracts';
import type { PfpTarget } from '#/meta/pfp';



export function once_store_updates(yw_store: Readable<any>, b_truthy=false): (typeof yw_store) extends Readable<infer w_out>? Promise<w_out>: never {
	return new Promise((fk_resolve) => {
		// ignore initialization call
		let b_initialized = false;

		// subscribe
		const f_unsubscribe = yw_store.subscribe((w_value) => {
			// runner gets called immediately, but wait for the update
			if(!b_initialized) {
				b_initialized = true;
				return;
			}

			// 
			if(!b_truthy || w_value) {
				// unsubscribe
				f_unsubscribe();

				// resolve with value
				fk_resolve(w_value);
			}
		});
	});
}

export function s2r_slide(dm_node: Element, {
	delay: xt_delay=0,
	duration: xt_duration=400,
	easing: f_easing=cubicOut,
	minHeight: x_height_min=0,
}: SvelteTransitionConfig & {minHeight?: number}): SvelteTransitionReturnType {
	const d_style = getComputedStyle(dm_node);
	const x_opacity = +d_style.opacity;
	const x_height = parseFloat(d_style.height);
	const x_padding_top = parseFloat(d_style.paddingTop);
	const x_padding_bottom = parseFloat(d_style.paddingBottom);
	const x_margin_top = parseFloat(d_style.marginTop);
	const x_margin_bottom = parseFloat(d_style.marginBottom);
	const x_border_top_width = parseFloat(d_style.borderTopWidth);
	const x_border_bottom_width = parseFloat(d_style.borderBottomWidth);

	return {
		delay: xt_delay,
		duration: xt_duration,
		easing: f_easing,
		css: xt => ''
			+'overflow: hidden;'
			+`opacity: ${Math.min(xt * 20, 1) * x_opacity};`
			+`height: ${(xt * (x_height - x_height_min)) + x_height_min}px;`
			+`padding-top: ${xt * x_padding_top}px;`
			+`padding-bottom: ${xt * x_padding_bottom}px;`
			+`margin-top: ${xt * x_margin_top}px;`
			+`margin-bottom: ${xt * x_margin_bottom}px;`
			+`border-top-width: ${xt * x_border_top_width}px;`
			+`border-bottom-width: ${xt * x_border_bottom_width}px;`,
	};
}

export function svelte_to_dom(
	dc_creator: ParametricSvelteConstructor,
	h_props: ParametricSvelteConstructor.Parts<typeof dc_creator>['params'],
	si_event?: string
): Promise<HTMLElement> {
	const dm_div = dd('div');

	const yc_component = new dc_creator({
		target: dm_div,
		props: h_props,
	});

	return new Promise((fk_resolve) => {
		if(si_event) {
			yc_component.$on(si_event, () => {
				fk_resolve(dm_div.firstChild as HTMLElement);
			});
		}
		else {
			fk_resolve(dm_div.firstChild as HTMLElement);
		}
	});
}


export async function load_pfps<
	p_res extends Resource.Path,
	g_res extends (Nameable & Pfpable),
>(h_resources: Record<p_res, g_res>, h_props: PfpDisplay['$$prop_def']): Promise<Record<p_res, HTMLElement>> {
	return ofe(
		await Promise.all(
			ode(h_resources).map(([_, g_resource]) => new Promise(
				(fk_resolve: (a_entry: [p_res, HTMLElement]) => void) => {
					const dm_dummy = dd('span');
					const yc_pfp = new PfpDisplay({
						target: dm_dummy,
						props: {
							...h_props,
							resource: g_resource,
							settle() {
								const dm_pfp = dm_dummy.firstChild?.cloneNode(true) as HTMLElement;
								yc_pfp.$destroy();
								fk_resolve([g_resource.pfp as p_res, dm_pfp]);
							},
						},
					});
				}
			))
		));
}


export interface Intent {
	id: string;
}

type Completable<w_complete extends any=any> = (b_answer: boolean, w_value?: w_complete) => void;

export interface PageContext {
	k_page: Page;
	g_cause: IntraExt.Cause | null;
	b_searching: boolean;
}

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
export function load_page_context(): PageContext {
	const k_page = getContext<Page>('page');
	const g_cause = getContext<IntraExt.Cause | null>('cause') || null;
	const b_searching = getContext<boolean>('searching') || false;

	return {
		k_page,
		g_cause,
		b_searching,
	};
}

export interface FlowContext<w_complete extends any=never> extends PageContext {
	completed: Completable<w_complete> | ([w_complete] extends [never]? undefined: never);
}

export function load_flow_context<w_complete extends any=never>(): FlowContext<w_complete> {
	// eslint-disable-next-line @typescript-eslint/no-extra-parens
	const completed = getContext<Completable<w_complete> | ([w_complete] extends [never]? undefined: never)>('completed');

	return {
		...load_page_context(),
		completed,
	};
}

export interface AppContext<w_complete extends any=any> extends FlowContext<w_complete> {
	g_app: AppStruct;
	p_app: AppPath;
	g_chain: ChainStruct;
	p_chain: ChainPath;
	p_account: AccountPath;
}

export interface LocalAppContext {
	p_app: AppPath;
	g_app: AppStruct;
	p_chain: ChainPath;
	g_chain: ChainStruct;
	p_account: AccountPath;
	g_account: AccountStruct;
	sa_owner: Bech32;
}

export interface PartialLocalAppContext {
	p_app: AppPath | undefined;
	g_app: AppStruct | null;
	p_chain: ChainPath | undefined;
	g_chain: ChainStruct | null;
	p_account: AccountPath | undefined;
	g_account: AccountStruct | null;
	sa_owner: Bech32 | undefined;
}

export interface LoadedAppContext<w_complete extends any=any> extends AppContext<w_complete>, LocalAppContext {
	g_account: AccountStruct;
}

export function load_app_context<w_complete extends any=any>() {
	const g_app = getContext<AppStruct>('app') || G_APP_STARSHELL;
	const p_app = Apps.pathFrom(g_app);
	const g_chain = getContext<ChainStruct>('chain');
	const p_chain = Chains.pathFrom(g_chain);
	const p_account = getContext<AccountPath>('accountPath');

	return {
		...load_flow_context<w_complete>(),
		g_app,
		p_app,
		g_chain,
		p_chain,
		p_account,
	};
}

/* eslint-enable */

