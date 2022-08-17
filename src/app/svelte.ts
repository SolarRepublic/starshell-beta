import type { Nameable, Pfpable } from '#/meta/able';
import type { Resource } from '#/meta/resource';
import type { ParametricSvelteConstructor } from '#/meta/svelte';
import { Dict, ode, ofe } from '#/util/belt';
import { dd } from '#/util/dom';
import { cubicOut } from 'svelte/easing';
import type { Readable } from 'svelte/store';
import PfpDisplay from './ui/PfpDisplay.svelte';

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

export function clean_slide(dm_node: Element, {
	delay: xt_delay=0,
	duration: xt_duration=400,
	easing: f_easing=cubicOut,
}: SvelteTransitionConfig): SvelteTransitionReturnType {
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
			+`height: ${xt * x_height}px;`
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
