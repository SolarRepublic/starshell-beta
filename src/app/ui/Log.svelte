<script context="module" lang="ts">
	export namespace LogItem {
		export interface String {
			type: 'string';
			value: string;
		}

		export interface Event {
			type: 'event';
			value: {
				message: string;
				offset: number;
			};
		}

		export type Any = String | Event;
	}

	export type LogItem = LogItem.Any;

	export class Logger {
		// private _a_items: LogItem[] = [];

		constructor() {
			this._a_items = [];
		}

		get items() {
			return this._a_items;
		}

		set items(a_items: LogItem[]) {
			this._a_items = a_items;
		}

		event(s_msg: string, xt_offset: number): this {
			this._a_items.push({
				type: 'event',
				value: {
					message: s_msg,
					offset: xt_offset,
				},
			});

			return this;
		}
	}
</script>

<script lang="ts">
	import { onMount } from "svelte";

	export let items: LogItem[];

	export let hide = false;

	function format_ms(n_ms: number): string {
		return (n_ms / 1000).toFixed(2).padStart(5, '0');
	}
</script>

<style lang="less">
	.log-container {
		font-family: 'PT Mono', monospace;

		>ol {
			>li {
				>span {
					&.string {

					}

					&.event {
					}
				}
			}
		}
	}
</style>

<div class="log-container" class:display_none={hide}>
	<ol>
		{#each items as g_item}
			<li>
				{#if 'string' === g_item.type}
					<span class="string">{g_item.value}</span>
				{:else if 'event' === g_item.type}
					<span class="event">
						<span class="offset">+{format_ms(g_item.value.offset)}ms: </span>
						<span class="message">{g_item.value.message}</span>
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</div>
