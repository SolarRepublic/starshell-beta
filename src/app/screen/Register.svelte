<script lang="ts">
	import {Screen} from './_screens';
	import {yw_progress} from '../mem';
	import {load_flow_context, make_progress_timer} from '../svelte';
	
	import Log, {Logger} from '#/app/ui/Log.svelte';
	import {Vault} from '#/crypto/vault';
	import {
		login,
		register,
	} from '#/share/auth';
	
	import {ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR} from '#/share/constants';
	import {AlreadyRegisteredError, InvalidPassphraseError} from '#/share/errors';
	
	import RegisterWeakPasswordSvelte from './RegisterWeakPassword.svelte';
	import NewPassword from '../frag/NewPassword.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import StarShellLogo from '../ui/StarShellLogo.svelte';
	import StarShellTitle from '../ui/StarShellTitle.svelte';
	

	// will be set if this is part of a flow
	const {
		k_page,
		completed,
	} = load_flow_context();

	// bindings
	let s_error = '';
	let s_info = '';

	let sh_phrase = '';
	let b_password_acceptable = false;

	let c_resets = 0;

	// time started registration
	let xt_start = 0;

	// logger instace
	let k_logger = new Logger();

	// log to logger
	function log(s_msg: string) {
		k_logger = k_logger.event(s_msg, Date.now() - xt_start);
	}

	// update the confirm action
	$: a_confirm_action = ['Continue', prepare_register, !b_password_acceptable] as const;

	// download top 10k list and parse it
	const dp_passwords = (async() => {
		const d_res = await fetch('/data/passwords-top-10k.txt');
		const s_list = await d_res.text();
		return s_list.split('\n');
	})();

	// prepare to register
	async function prepare_register() {
		// check against top 10k list
		const a_passwords = await dp_passwords;

		// password found in list
		if(a_passwords.includes(sh_phrase)) {
			k_page.push({
				creator: RegisterWeakPasswordSvelte,
				props: {
					attempt_register,
					password: sh_phrase,
				},
			});
		}
		// password not in list
		else {
			await attempt_register();
		}
	}

	// registration is busy
	let b_busy = false;
	
	// attempt to register
	async function attempt_register(s_password?: string): Promise<1> {
		// restore password from caller
		if(s_password) sh_phrase = s_password;

		// invalid state
		if(!b_password_acceptable) return 1;

		// do not interupt; lock
		if(b_busy) return 1; b_busy = true;

		// prep graceful exit
		const exit = (): 1 => {
			$yw_progress = [0, 0];
			b_busy = false;
			return 1;
		};

		// reset error
		s_error = '';

		// start timer
		xt_start = Date.now();

		$yw_progress = [15, 100];

		log('Estimating time to complete');

		// estimate time to complete
		let f_cancel!: VoidFunction;
		let xt_estimate = 0;
		{
			const xt_start_est = window.performance.now();
			const X_SAMPLE = 44;
			await Vault.deriveRootBitsArgon2(ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR, 1 / X_SAMPLE);
			const xt_finish_est = window.performance.now();

			const xt_elapsed = xt_finish_est - xt_start_est;
			xt_estimate = 1.2 * (xt_elapsed * X_SAMPLE);
			log(`About ${(xt_estimate / 1e3).toFixed(1)} seconds`);

			$yw_progress = [5, 100];
	
			if(xt_estimate > 10e3) {
				const n_minutes = Math.ceil(xt_estimate / 1e3 / 60);
				s_info = `This could take up to ${n_minutes} minute${1 === n_minutes? '': 's'}. Do not leave this screen`;
			}

			f_cancel = make_progress_timer({
				estimate: xt_estimate,
				range: [5, 50],
			});
		}

		// restore password from caller (again, after restore wiped it)
		if(s_password) sh_phrase = s_password;

		// attempt to register
		try {
			await register(sh_phrase, log);
		}
		// handle error
		catch(e_register) {
			if(e_register instanceof AlreadyRegisteredError) {
				s_error = 'A passphrase is already registered';
			}
			else if(e_register instanceof InvalidPassphraseError) {
				s_error = 'Invalid passphrase';
			}
			else {
				s_error = `Unexpected error occurred while attempting to register:\n${e_register.stack || e_register.message}`;
			}

			// exit
			return exit();
		}
		finally {
			f_cancel();
		}

		log('Verifying passphrase');

		f_cancel = make_progress_timer({
			estimate: xt_estimate,
			range: [50, 100],
		});

		// attempt login
		try {
			await login(sh_phrase, false, log);
		}
		// failed to verify
		catch(e_login) {
			s_error = `Failed to verify passphrase immediately after registration:\n${e_login.stack}`;

			// reset vault
			await Vault.eraseBase();

			// exit
			return exit();
		}
		finally {
			f_cancel();
		}

		log('Done');

		// proceed
		s_error = 'Success';

		// complete
		if(completed) completed(true);

		// done
		return exit();
	}
</script>

<style lang="less">
	@import '../../style/util.less';

	.registration-info {
		text-align: center;
		margin-left: auto;
		margin-right: auto;
	}

	.intro {
		margin-top: 1em;
		// margin-bottom: 4em;
		margin-bottom: 0;

		.lead {
			margin-top: 1em;
			margin-bottom: 0;
		}

		.title {
			letter-spacing: 1px;
			font-weight: 100;
			font-size: 27px;
			color: #d0d0d0;
			margin: 0;

			em {
				font-size: 32px;
				font-style: normal;
			}
		}

		.logo {
			height: 34vh;
			width: auto;
		}

		.icon {
			--svg-color-fg: silver;
			// --svg-color-bg: #f52525;
			width: calc(100% - 60px);
			height: auto;

			.graphic({
				:global(&) {
					width: 172px;
					height: 137px;
					margin: 10px 0;
				}
			});

			>svg {
				:global(&) {
					margin: 0;
				}
			}
		}
		
	}

	.narrow {
		color: var(--theme-color-text-med);
		font-weight: 300;
		max-width: 18em;
	}
</style>

<Screen>
	<center>
		<div class="intro">
			<StarShellLogo dim={96} />

			<StarShellTitle width={150} />
		</div>

		<p class="narrow">
			Create a new password to protect your wallet's data.
		</p>
	</center>

	<NewPassword b_disabled={b_busy} bind:sh_phrase={sh_phrase} bind:b_acceptable={b_password_acceptable} bind:c_resets={c_resets} />

	{#if s_info}
		<div class="registration-info">{s_info}</div>
	{/if}

	<Log latest bind:items={k_logger.items} />

	{#if s_error}
		<pre>{s_error}</pre>
	{/if}


	<ActionsLine confirm={a_confirm_action} />
</Screen>
