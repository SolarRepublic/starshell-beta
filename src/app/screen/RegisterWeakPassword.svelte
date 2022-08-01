<script lang="ts">
	import {getContext} from 'svelte';

	import ActionsLine from '../ui/ActionsLine.svelte';
	import {Screen, type Page} from './_screens';


	export let attempt_register: VoidFunction;
	export let weakness: number;
	const i_weakness = weakness;

	// get page from context
	const k_page = getContext<Page>('page');

	function use_anyway() {
		attempt_register();
		k_page.pop();
	}
</script>

<Screen>
	<h3>
		Weak Password Warning
	</h3>

	<p>
		The password you entered was found on a list of the top ten thousand most commonly used passwords.
	</p>

	<p>
		In order to help prevent the loss of funds, you are encouraged to create a strong, unique password.
	</p>

	<p>
		How do you want to proceed?
	</p>

	<ActionsLine cancel='pop' confirm={['Use anyway', use_anyway]} wait={5000} />
</Screen>