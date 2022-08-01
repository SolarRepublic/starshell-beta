<script lang="ts">
	import { getContext } from 'svelte';

	import Log, { Logger } from '#/app/ui/Log.svelte';

	import { Vault } from '#/crypto/vault';
	import type { Completed } from '#/entry/flow';

	import {
		ATU8_DUMMY_PHRASE,
		ATU8_DUMMY_VECTOR,
		login,
		CorruptedVaultError,
		InvalidPassphraseError,
		RecoverableVaultError,
		UnregisteredError,
	} from '#/share/auth';

	import { Screen, type Page } from './_screens';
	import ActionsLine from '#/app/ui/ActionsLine.svelte';
	import Field from '#/app/ui/Field.svelte';
	import { slide } from 'svelte/transition';

	// will be set if part of flow
	const completed = getContext<Completed | undefined>('completed');

	// password value binding
	let sh_password = '';

	// password error
	let s_err_password = '';

	// busy attempting unlock
	let b_busy = false;


	let xt_start = 0;
	let k_logger = new Logger();
	function log(s_msg: string) {
		k_logger = k_logger.event(s_msg, Date.now() - xt_start);
	}

	async function attempt_unlock(b_recover=false): Promise<1> {
		// do not interupt; lock
		if(b_busy) return 1; b_busy = true;

		// prep graceful exit
		const exit = (): 1 => (b_busy = false, 1);

		// reset error
		s_err_password = '';

		// start timer
		xt_start = Date.now();

		log('Estimating time to complete');

		// estimate time to complete
		{
			const xt_start_est = window.performance.now();
			await Vault.deriveRootBits(ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR, 1 / 50);
			const xt_finish_est = window.performance.now();

			const xt_elapsed = xt_finish_est - xt_start_est;
			const xt_estimate = (2 * (xt_elapsed * 50));
			log(`About ${(xt_estimate / 1000).toFixed(1)} seconds`);
		}

		// attempt login
		try {
			await login(sh_password, b_recover, log);
		}
		// handle error
		catch(e_login) {
			if(e_login instanceof UnregisteredError) {
				s_err_password = 'No accounts detected';
			}
			else if(e_login instanceof InvalidPassphraseError) {
				s_err_password = 'Invalid passphrase';
			}
			else if(e_login instanceof RecoverableVaultError) {
				s_err_password = 'Vault is partially corrupted; attempting recovery...';
				return await attempt_unlock(true);
			}
			else if(b_recover) {
				s_err_password = `Recovery failed. Vault may be irreparably corrupted.\n${e_login.message!}`;
			}
			else if(e_login instanceof CorruptedVaultError) {
				s_err_password = `Vault appears to be irreparably corrupted.\n${e_login.message}`;
			}
			else {
				s_err_password = `Unknown error occurred: ${e_login.stack || e_login.message}`;
			}

			// exit
			return exit();
		}

		// success
		if(completed) completed(true);

		// exit
		return exit();
	}

</script>

<style lang="less">
	@import '../../style/util.less';

	.welcome {
		:global(&) {
			align-items: center;
			justify-content: center;
			text-align: center;
			gap: 20px;
			padding-left: 16px;
			padding-right: 16px;
			background-image: url('/media/vendor/orb-1.svg');
			background-repeat: no-repeat;
			background-position: center top;
			background-size: cover;
			padding-top: calc(50vh - 200px);
		}

		>div {
			&.logo,&.title {
				:global(&) {
					margin-left: auto !important;
					margin-right: auto !important;
				}
			}
		}
	}


	.large {
		.font(big);
	}

	p {
		.font(regular);
		padding: 8px 0;
	}

	.line {
		width: calc(100% - 40px);
		height: 1px;
		background: radial-gradient(50% 50% at 50% 50%, #FFC700 0%, rgba(255, 199, 0, 0) 100%);
	}

	.actions-line {
		width: 100%;
	}

	.off-screen {
		position: absolute;
		top: calc(var(--app-window-width) * 100);
	}
</style>

{#if false}
	<span
		class:welcome={true}
	/>
{/if}

<Screen debug='Authenticate' classNames='welcome'>
	<div class="logo">
		<img width="96" src="/media/vendor/logo-96px.png" srcset="/media/vendor/logo-96px.png 1x, /media/vendor/logo-192px.png 2x" alt="StarShell" />
	</div>

	<div class="title">
		<img src="/media/vendor/title.svg" alt="" />
	</div>

	<div class="line">&nbsp;</div>

	<div class="form flex-rows">
		<Field key="password" name="">
			<input
				type="password"
				name="password"
				placeholder="Password"
				bind:value={sh_password}
				class:invalid={s_err_password}
			/>

			{#if s_err_password}
				<div class="validation-message" transition:slide={{duration:300}}>
					{s_err_password}
				</div>
			{/if}
		</Field>
	</div>

	<ActionsLine confirm={['Unlock', attempt_unlock]} />

	<Log bind:items={k_logger.items} hide />

</Screen>
