<script lang="ts">
	import {yw_context_popup, yw_popup, yw_progress} from '../mem';
	import {make_progress_timer} from '../svelte';
	
	import {Argon2, Argon2Type} from '#/crypto/argon2';
	import {Bip39} from '#/crypto/bip39';
	import {ATU8_DUMMY_PHRASE, ATU8_SHA256_STARSHELL} from '#/share/constants';
	import {microtask} from '#/util/belt';
	import {open_external_link} from '#/util/dom';
	
	import MnemonicInput from './MnemonicInput.svelte';
	import PopupExportFile from '../popup/PopupExportFile.svelte';
	import PopupProcessing from '../popup/PopupProcessing.svelte';
	import Curtain from '../ui/Curtain.svelte';
	import Tooltip from '../ui/Tooltip.svelte';
	
	import SX_ICON_DOWNLOAD from '#/icon/download.svg?raw';

	
	
	export let atu16_indicies: Uint16Array = new Uint16Array(24);

	export let b_readonly = false;

	const nl_words = atu16_indicies.length;
	const nl_rows = Math.floor(nl_words / 2);

	const a_absents = new Array(nl_rows).fill(false);

	const N_GROUPS = 2;
	const N_WORDS_PER_GROUP = 3;
	const atu16_indicies_fake = crypto.getRandomValues(new Uint16Array(24 * N_GROUPS * N_WORDS_PER_GROUP)).map(n => n % 2048);
	const atu8_noise = crypto.getRandomValues(new Uint8Array(24 * N_GROUPS));

	function noise(i_word: number): number[] {
		return Array.from({
			length: atu8_noise[i_word] % N_WORDS_PER_GROUP,
		}, (w, i_pos) => i_word+i_pos);
	}

	let b_tooltip_showing = false;

	
	async function export_backup(atu8_phrase: Uint8Array) {
		// loading
		$yw_popup = null;

		await microtask();

		// estimate time to complete hashing
		let xt_estimate = 0;
		let f_cancel: VoidFunction;
		{
			$yw_progress = [1, 100];

			$yw_context_popup = {
				status: 'Estimating time to complete...',
			};

			$yw_popup = PopupProcessing;

			// perform sample
			{
				const xt_start = Date.now();
				await Argon2.hash({
					type: Argon2Type.Argon2id,
					phrase: ATU8_DUMMY_PHRASE,
					salt: ATU8_SHA256_STARSHELL,
					hashLen: 32,
					mem: 1 << 10,
					time: 1,
				});
				const xt_elapsed = Date.now() - xt_start;
				xt_estimate = xt_elapsed * 64;
			}

			$yw_progress = [2, 100];

			$yw_context_popup = {
				status: 'Hardening password...',
			};

			// progress at estimated pace
			f_cancel = make_progress_timer({
				estimate: xt_estimate,
				range: [2, 100],
			});
		}


		// mnemonic length
		const g_exported = await Bip39.exportIndicies(() => atu16_indicies, atu8_phrase);

		// done processing
		f_cancel();

		// close popup
		$yw_popup = null;

		// download file
		{
			const d_blob = new Blob([JSON.stringify(g_exported, null, '\t')], {type:'octet/stream'});
			const d_url = URL.createObjectURL(d_blob);
			const dm_a = document.createElement('a');
			dm_a.href = d_url;
			dm_a.download = 'starshell-wallet-mnemonic.json';
			dm_a.click();
		}
	}

	function show_export_popup() {
		$yw_context_popup = {
			title: 'Save Mnemonic to Encrypted File',
			save(atu8_phrase: Uint8Array) {
				void export_backup(atu8_phrase);
			},
		};

		$yw_popup = PopupExportFile;
	}

	let b_avanced = false;
</script>

<style lang="less">
	@import '../_base.less';

	.mnemonic {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.mnemonic-words {
		.hide-scrollbar();

		flex: 0;

		display: flex;
		flex-direction: row;
		gap: 2em;

		>.column {
			flex: 1;
			gap: 0.5em;
			display: grid;

			>.item {
				border-bottom: 1px solid fade(@theme-color-graymed, 20%);

				>.index {
					width: 1.5em;
					display: inline-block;
					text-align: center;
					color: var(--theme-color-text-med);
				}

				>.word {
					color: var(--theme-color-text-light);
				}

				&.warning {
					border-bottom-color: var(--theme-color-caution);

					>.index {
						color: var(--theme-color-caution);
					}
				}
			}
		}

		border-radius: var(--ui-border-radius);
		border: 1px dashed var(--theme-color-border);
		padding: var(--ui-padding);
		padding-top: calc(var(--ui-padding) * 0.6);
		padding-bottom: calc(var(--ui-padding) * 0.6);
	}

	.controls {
		display: flex;
		justify-content: space-between;
		font-size: 13px;

		>.wordlist {
			>.wordlist-title {
				color: var(--theme-color-text-med);
			}

			>.wordlist-value {
				border: 1px solid var(--theme-color-border);
				padding: 2px 6px;
				background-color: rgba(0,0,0,0.2);
			}
		}
	}
</style>

<div class="mnemonic">
	<div class="controls">
		<span class="title">
			BIP-39 Mnemonic Phrase 
			<Tooltip bind:showing={b_tooltip_showing}>
				Only the <span class="link" on:click={() => open_external_link('https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt')}>english BIP-39 wordlist</span> is currently supported.
				<br><br>
				{#if b_readonly}
					Do NOT copy the wordlist to your clipboard. It is recommended that you do not store this digitally. If you must, use the "export" feature to store an encrypted copy.
					<br><br>
					Recording your mnemonic onto a physical medium (pen and paper, metal stamping, etc.) is the recommended backup method.
				{:else}
					Type your full mnemonic into the form below. Use tab or space bar to advance to the next input. Pasting and importing are also supported.
				{/if}
			</Tooltip>
		</span>

		<span class="wordlist">
			<span class="wordlist-title">
				wordlist:
			</span>
			<span class="wordlist-value">
				ENGLISH
			</span>
		</span>
	</div>

	<div class="mnemonic-words">
		{#each Array.from({length:2}, (w, i) => i) as i_group}
			<div class="column">
				{#each atu16_indicies.subarray(0, nl_rows) as xb_index, i_sub}
					{@const i_word = i_sub+(i_group * nl_rows)}

					<!-- create a random amount of fake inputs around each actual input to mitigate attacks on browser's field cache -->
					{#each noise(i_word * 2) as i_fake}
						<div class="display_none">
							<MnemonicInput atu16_indicies={atu16_indicies_fake} i_index={i_fake} />
						</div>
					{/each}

					<div class="item" class:warning={a_absents[i_word]}>
						<span class="index">
							{i_word+1}.
						</span>
						<MnemonicInput atu16_indicies={atu16_indicies} i_index={i_word} {b_readonly}
							bind:b_absent={a_absents[i_word]}
						/>
					</div>

					{#each noise(i_word * 2 + 1) as i_fake}
						<div class="display_none">
							<MnemonicInput atu16_indicies={atu16_indicies_fake} i_index={i_fake} />
						</div>
					{/each}
				{/each}
			</div>
		{/each}
	</div>

	<div class="extras text-align_right">
		<span class="link" on:click={show_export_popup}>
			<span class="global_svg-icon icon-diameter_18px">
				{@html SX_ICON_DOWNLOAD}
			</span>
			<span>
				Save to backup file
			</span>
		</span>

		<span class="link" on:click={() => b_avanced = true}>
			<span class="global_svg-icon icon-diameter_18px">
				{@html SX_ICON_DOWNLOAD}
			</span>
			<span>
				Show advanced
			</span>
		</span>
	</div>
</div>

<p>
	This mnemonic phrase will be stored to your wallet in an encrypted form so that you can create multiple accounts with it.
</p>

<Curtain on:click={() => b_tooltip_showing = false} />
