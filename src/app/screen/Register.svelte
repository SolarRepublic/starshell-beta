<script lang="ts">
	import {slide} from 'svelte/transition';
	
	import {Screen} from './_screens';
	import {load_flow_context} from '../svelte';
	
	import Field from '#/app/ui/Field.svelte';
	import Log, {Logger} from '#/app/ui/Log.svelte';
	import {Vault} from '#/crypto/vault';
	import {
		acceptable,
		login,
		register,
	} from '#/share/auth';
	
	import {ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR, NL_PASSPHRASE_MAXIMUM, NL_PASSPHRASE_MINIMUM} from '#/share/constants';
	import {AlreadyRegisteredError, InvalidPassphraseError} from '#/share/errors';
	
	import RegisterWeakPasswordSvelte from './RegisterWeakPassword.svelte';
	import ActionsLine from '../ui/ActionsLine.svelte';
	import StarShellLogo from '../ui/StarShellLogo.svelte';
	import StarShellTitle from '../ui/StarShellTitle.svelte';
	
	

	// will be set if this is part of a flow
	const {
		k_page,
		completed,
	} = load_flow_context();

	// bindings
	let sh_phrase = '';
	let sh_verify = '';
	let s_error = '';

	let s_err_password = '';
	let s_err_verify = '';

	// time started registration
	let xt_start = 0;

	// logger instace
	let k_logger = new Logger();

	// log to logger
	function log(s_msg: string) {
		k_logger = k_logger.event(s_msg, Date.now() - xt_start);
	}


	// continuously check the acceptability of the password
	$: b_password_acceptable = !!sh_phrase && sh_phrase === sh_verify && acceptable(sh_phrase);

	// update the confirm action
	$: a_confirm_action = ['Continue', prepare_register, !b_password_acceptable] as const;


	// listen for page event restore
	k_page.on({
		restore() {
			// clear passwords
			sh_phrase = sh_verify = '';
		},
	});

	function check_password() {
		if(sh_phrase && !acceptable(sh_phrase)) {
			if(sh_phrase.length < NL_PASSPHRASE_MINIMUM) {
				s_err_password = 'Password must be at least 5 characters';
			}
			else if(sh_phrase.length > NL_PASSPHRASE_MAXIMUM) {
				s_err_password = 'Password must be 1024 characters or fewer';
			}
			else {
				s_err_password = 'Password is not acceptable';
			}

			return;
		}

		s_err_password = '';
	}

	function check_verify() {
		if(sh_phrase && !s_err_password && sh_phrase !== sh_verify) {
			s_err_verify = 'Passwords do not match';
			return;
		}

		s_err_verify = '';
	}

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
		const exit = (): 1 => (b_busy = false, 1);

		// reset error
		s_error = '';

		// start timer
		xt_start = Date.now();

		log('Estimating time to complete');

		// estimate time to complete
		{
			const xt_start_est = window.performance.now();
			await Vault.deriveRootBits(ATU8_DUMMY_PHRASE, ATU8_DUMMY_VECTOR, 1 / 50);
			const xt_finish_est = window.performance.now();

			const xt_elapsed_est = xt_finish_est - xt_start_est;
			const xt_estimate = 2 * (2 * (xt_elapsed_est * 50));
			log(`About ${(xt_estimate / 1000).toFixed(1)} seconds`);

			if(xt_estimate > 10e3) {
				log(`This could take a while. Please be patient`);
			}
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

		log('Verifying passphrase');

		// attempt login
		try {
			await login(sh_phrase, false, log);
		}
		// failed to verify
		catch(e_login) {
			debugger;
			s_error = `Failed to verify passphrase immediately after registration:\n${e_login.stack}`;

			// reset vault
			await Vault.eraseBase();

			// exit
			return exit();
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

	<div class="form flex-rows">
		<!-- <input hidden
			type="text"
			name="username"
			autocomplete="username"
			value="StarShell Wallet User"> -->

		<Field key="password" name="New password">
			<!-- autocomplete="new-password" -->
			<input
				type="password"
				autocomplete="off"
				name="password"
				placeholder="Password"
				on:blur={() => check_password()}
				bind:value={sh_phrase}
				disabled={b_busy}
			>

			{#if !b_password_acceptable && s_err_password}
				<div class="validation-message" transition:slide={{duration:300}}>
					{s_err_password}
				</div>
			{/if}
		</Field>

		<Field key="verify-password" name="Verify password">
			<input
				type="password"
				autocomplete="off"
				name="verify"
				placeholder="Password"
				on:blur={() => check_verify()}
				bind:value={sh_verify}
				disabled={b_busy}
			>

			{#if !b_password_acceptable && s_err_verify}
				<div class="validation-message" transition:slide={{duration:300}}>
					{s_err_verify}
				</div>
			{/if}
		</Field>

	</div>

	<Log bind:items={k_logger.items} />

	{#if s_error}
		<pre>{s_error}</pre>
	{/if}


	<ActionsLine confirm={a_confirm_action} />
</Screen>
