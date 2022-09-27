import type {Completed} from '#/entry/flow';
import type {Nameable, Pfpable} from '#/meta/able';
import type {AccountPath} from '#/meta/account';
import {AppApiMode, AppInterface} from '#/meta/app';
import type {ChainInterface} from '#/meta/chain';
import type {Resource} from '#/meta/resource';
import type {ParametricSvelteConstructor} from '#/meta/svelte';
import {H_LOOKUP_PFP} from '#/store/_init';
import {ode, ofe} from '#/util/belt';
import {dd} from '#/util/dom';
import {getContext} from 'svelte';
import {cubicOut} from 'svelte/easing';
import type {Readable} from 'svelte/store';
import PfpDisplay from './ui/PfpDisplay.svelte';
import type {Page} from '##/nav/page';
import type {AppProfile} from '#/store/apps';
import type {IntraExt} from '#/script/messages';
import {SessionStorage} from '#/extension/session-storage';


export const G_APP_STARSHELL: AppInterface = {
	scheme: 'wallet' as 'https',
	host: 'StarShell',
	api: AppApiMode.STARSHELL,
	connections: {},
	name: 'StarShell',
	pfp: H_LOOKUP_PFP['/media/vendor/logo.svg'],
};


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

	if(si_event) {
		return new Promise((fk_resolve) => {
			yc_component.$on(si_event, () => {
				fk_resolve(dm_div.firstChild as HTMLElement);
			});
		});
	}
	else {
		return Promise.resolve(dm_div.firstChild as HTMLElement);
	}
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

type Completable<w_complete extends any=any> = (w_value: w_complete) => void;

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
export function load_page_context() {
	const k_page = getContext<Page>('page');
	const g_cause = getContext<IntraExt.Cause | null>('cause') || null;

	return {
		k_page,
		g_cause,
	};
}

export function load_flow_context<w_completed extends any=any>() {
	const completed = getContext<Completable<w_completed> | undefined>('completed');

	return {
		...load_page_context(),
		completed,
	};
}

export function load_app_context<w_complete extends any=any>() {
	const g_app = getContext<AppInterface>('app') || G_APP_STARSHELL;
	const g_chain = getContext<ChainInterface>('chain');
	const p_account = getContext<AccountPath>('accountPath');

	return {
		...load_flow_context<w_complete>(),
		g_app,
		g_chain,
		p_account,
	};
}

export async function load_app_profile(g_app: AppInterface) {
	const p_profile = `profile:${g_app.scheme}://${g_app.host}` as const;
	console.log({p_profile});
	const g_profile = await SessionStorage.get(p_profile);
	if(!g_profile) return;

	return g_profile as AppProfile;
}
/* eslint-enable */
