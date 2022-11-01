<script lang="ts">
	import type {Nameable, Pfpable} from '#/meta/able';
	import type {Dict, Promisable} from '#/meta/belt';
	import type {PfpTarget} from '#/meta/pfp';
	
	import {onDestroy} from 'svelte';
	
	import {yw_store_tags} from '../mem';
	
	import {oderom} from '#/util/belt';
	
	import InlineTags from './InlineTags.svelte';
	import Load from './Load.svelte';
	import PfpDisplay from './PfpDisplay.svelte';
	
	
	// import LockOutline from 'svelte-material-icons/LockOutline.svelte';
	
	// import {
	// 	H_ADDR_TO_CONTACT,
	// 	H_ICONS,
	// 	H_TAGS,
	// } from '#/sim/data';
	
	// import Address from './Address.svelte';

	/**
	 * Path to base resource to represent
	 */
	export let resourcePath = '';
	const p_resource = resourcePath;

	/**
	 * Base resource to represent
	 */
	export let resource: (Nameable & Pfpable) = null!;
	const g_resource = resource;
	
	/**
	 * Overrides name automatically extracted from resource
	 */
	export let name: Promisable<string> = g_resource?.name;

	/**
	 * Adds ` ({VALUE})` after the name in a dimmer color
	 */
	export let postname = '';
	const s_postname = postname;

	export let postnameTags = false;

	/**
	 * Disables pfp
	*/
	export let noPfp = false;

	/**
	 * Overrides pfp automatically extracted from resource
	 */
	export let pfp: PfpTarget = g_resource?.pfp;
	const p_pfp = pfp;

	/**
	 * Sets the dimensions of the pfp icon
	 */
	export let pfpDim = 36;
	const x_dim_pfp = pfpDim;

	/**
	 * Indicates the row's pfp comes from an app
	 */
	export let appRelated = false;

	/**
	 * Optional dict to use to create data attributes on root element
	 */
	export let data: Dict = {};
	
	const h_data_attrs = oderom(data, (si_key, s_value) => ({
		[`data-${si_key}`]: s_value,
	}));

	export let amount: Promisable<string> = '';
	export let fiat: Promisable<string> = '';
	export let symbol = '';
	export let lockIcon = false;
	export let address = '';
	export let detail = '';
	export let prefix = '';


	// export let tagRefs: Tag.Ref[] | null = null;
	export let rootStyle = '';

	export let noHorizontalPad = false;
	if(noHorizontalPad) {
		rootStyle = `
			padding-left: 0;
			padding-right: 0;
			${rootStyle}
		`;
	}

	export let rootClasses = '';
	const s_classes = rootClasses;

	export let iconClass = '';
	// const k_icon = icon;
	// $: a_tags = tagRefs?.length? tagRefs.map(p_tag => H_TAGS[p_tag]): [];

	// load tags from resource path
	const a_tags = $yw_store_tags?.getTagsFor(p_resource) || [];
	
	const as_intervals = new Set<number>();

	onDestroy(() => {
		for(const i_interval of as_intervals) {
			clearInterval(i_interval);
		}
	});

	let s_spin = '';
	async function start_spinner<w_value>(dp_thing: Promisable<w_value>): Promise<w_value> {
		const A_SPIN = ['◜ ◝', ' ˉ◞', ' ˍ◝', '◟ ◞', '◜ˍ ', '◟ˉ '];
		let i_spin = 0;
		s_spin = A_SPIN[0];

		// thing is a promise
		if(dp_thing instanceof Promise) {
			// start spinner
			const i_interval = window.setInterval(() => {
				i_spin = (i_spin + 1) % A_SPIN.length;
				s_spin = A_SPIN[i_spin];
			}, 125);

			// add to intervals
			as_intervals.add(i_interval);

			// await thing to resolve
			const w_value = await dp_thing;

			// stop interval
			clearInterval(i_interval);

			// return value
			return w_value;
		}

		return dp_thing;
	}


	// const k_contact = address? H_ADDR_TO_CONTACT[address] || null: null;

</script>

<style lang="less">
	@import './_base.less';

	.monoline() {
		white-space: nowrap;
		overflow-x: hidden;
		text-overflow: ellipsis;
	}

	:root {
		--row-padding: 20px;
		--icon-margin: 14px;
	}

	.row {
		padding: var(--row-padding);
		border-top: 1px solid var(--theme-color-border);
		border-bottom: 1px solid var(--theme-color-border);
		max-width: var(--app-window-width);
		// overflow-x: scroll;
		cursor: pointer;

		// display: flex;
		// align-items: center;

		display: flex;
		flex-direction: column;

		>.banner {
			display: flex;
			align-items: center;
		}

		&:nth-child(n+2) {
			border-top-color: transparent;
		}

		
		.icon {
			--icon-diameter: var(--icon-diameter, var(--app-icon-diameter));
			// align-self: flex-start;
			// margin-top: 2px;

			flex: 0 0 var(--icon-diameter);
			margin-right: var(--icon-margin);

			&.bordered {
				--icon-diameter: calc(var(--app-icon-diameter) - 2px);
				background-color: var(--button-color, var(--theme-color-border));
			}

			&>.icon-20 {
				:global(&) {
					--icon-diameter: 18px;
				}
			}

			img {
				:global(&) {
					border-radius: 20%;
				}
			}

			&.site {
				:global(&) {
					background-color: var(--theme-color-text-light);
				}
			}
		}

		// display: flex;
		// flex-direction: row;
		// justify-content: center;

		.content {
			flex: auto;

			display: flex;
			max-width: calc(var(--app-window-width) - var(--app-icon-diameter) - var(--icon-margin) - var(--row-padding) - var(--row-padding));

			>.part {
				flex: auto;

				display: flex;
				flex-direction: column;

				&.main {
					overflow: hidden;

					>.title {
						display: flex;
						gap: 16px;
						align-items: center;
						flex: 0;

						>.name {
							.font(regular);

							display: inline-flex;
							max-width: 100%;

							>.text {
								max-width: 100%;
								.monoline();
							}

							.postname {
								color: var(--theme-color-text-med);
							}
						}

						>.symbol {
							color: var(--theme-color-text-med);
							margin-left: 0.63ch;
						}

						>svg {
							:global(&) {
								margin-left: -1px;
								vertical-align: -3px;
							}
						}
					}

					>.subtitle {
						flex: 0;

						>:nth-child(n+2) {
							:global(&) {
								margin-left: 4px;
							}
						}

						>.detail {
							color: var(--theme-color-text-med);
							
							.font(tiny);
						}

						>.contact {
							display: flex;
							color: var(--theme-color-text-med);
							.font(tiny);
							
							>.icon {
								--icon-diameter: 0.8em;
								--icon-margin: 0.5em;
								margin-top: -1px;
								color: var(--theme-color-text-med);
							}
							>.text {
							}
						}
					}
				}
				
				&.status {
					text-align: right;
					max-width: 55%;

					.amount {
						.font(regular);
						flex: 0;
					}

					.fiat-container {
						:global(.fiat) {
							.font(tiny);
							flex: 0;
							color: var(--theme-color-text-med);
							white-space: nowrap;
						}
					}
				}
			}
		}
	}

	.number {
		display: inline-flex;
		max-width: 18ch;
		overflow-x: scroll;
		.hide-scrollbar();

		white-space: nowrap;
	}

	.rest {
		margin-left: calc(var(--icon-margin) + var(--app-icon-diameter));
	}
</style>

<div class="row {s_classes}" style={rootStyle} {...h_data_attrs} on:click>
	<div class="banner">
		{#if !noPfp}
			<span class="icon {iconClass}">
				<slot name="icon">
					{#await name}
						<PfpDisplay path={p_pfp} name={'?'} dim={x_dim_pfp} {appRelated} />
					{:then s_name}
						<PfpDisplay path={p_pfp} name={s_name} dim={x_dim_pfp} {appRelated} />
					{/await}
				</slot>
			</span>
		{/if}
		<span class="content">
			<span class="main part">
				<div class="title">
					<span class="name">
						<slot name="prename" />
						<span class="text">
							<Load input={name} />
							{#if s_postname}
								<span class="postname">
									({s_postname})
								</span>
							{/if}
						</span>
					</span>

					{#if postnameTags}
						<InlineTags subtle rootStyle='margin: 0px;'
							{resourcePath}
						/>
					{/if}
					<!-- {#if symbol}
						<span class="symbol">
							{symbol}
						</span>
					{/if} -->
					{#if lockIcon}
						<!-- <LockOutline color='var(--theme-color-text-med)' size='18px' /> -->
					{/if}
				</div>
				{#if address || symbol || detail || a_tags.length || $$slots.detail}
					<div class="subtitle">
	<!-- 					
						{#if k_contact}
							<span class="contact">
								<span class="icon">
									<Fa icon={faUser} />
								</span>
								<span class="text">
									{k_contact.def.label}
								</span>
							</span> -->
						{#if detail || symbol || $$slots.detail}
							<span class="detail">
								<slot name="detail">
									{prefix}{detail || symbol}
								</slot>
							</span>
						{:else if address}
							<!-- <Address address={address} /> -->
						{/if}
					</div>
				{/if}
			</span>

			<span class="status part">
				{#if $$slots.status}
					<slot name="status"></slot>
				{:else if amount}
					<div class="amount">
						<span class="number">
							<Load input={amount} pad />
							<!-- {#await start_spinner(amount)}
								<span class="font-family_mono">
									{s_spin}
								</span>
							{:then s_amount}
								<span>
									{amount}
								</span>
							{/await} -->
						</span>
					</div>

					{#if fiat}
						<div class="fiat-container">
							<Load input={fiat} classes="fiat" pad />
						</div>
					{/if}
				{/if}
			</span>
		</span>
		{#if $$slots.right}
			<slot name="right" />
		{/if}
	</div>

	<div class="rest">
		{#if a_tags.length || $$slots.tags}
			<slot name="tags">
				<!-- <Tags tags={a_tags} collapsed /> -->
				<!-- <InlineTags subtle rootStyle='margin: 0px;'
					{resourcePath}
				>
				</InlineTags> -->
			</slot>
		{/if}

		<slot name="below"></slot>
	</div>
</div>
