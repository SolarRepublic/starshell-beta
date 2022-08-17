<script lang="ts">
	import {Tabs, TabList, Tab, TabPanel} from 'svelte-tabs';
	import Field from './Field.svelte';

	export let memoPlaintext: string | null;

	export let memoCiphertext = '';
</script>

<Field
	key='memo'
	name='Memo'
>
	{#if memoCiphertext}
		<Tabs>
			<TabList>
				<Tab>
					Plaintext
				</Tab>
				<Tab>
					Encrypted
				</Tab>
			</TabList>

			<TabPanel>
				{#if memoPlaintext}
					<textarea disabled>{memoPlaintext}</textarea>
				{:else if '' === memoPlaintext}
					<i>Empty memo</i>
				{:else}
					<i>Corrupted memo, unable to decrypt</i>
				{/if}
			</TabPanel>

			<TabPanel>
				<textarea class="ciphertext" disabled>{memoCiphertext}</textarea>
			</TabPanel>
		</Tabs>
	{:else if memoPlaintext}
		<textarea disabled>{memoPlaintext}</textarea>
	{:else}
		<span class="empty-memo">(empty)</span>
	{/if}
</Field>