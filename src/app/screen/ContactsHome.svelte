<script lang="ts">
	import {ContactAgentType} from '#/meta/contact';
	
	import {
		Tabs,
		Tab,
		TabList,
		TabPanel,
	} from 'svelte-tabs';
	
	import {Screen, Header} from './_screens';
	
	import ContactList from '../frag/ContactList.svelte';
	import SubHeader from '../ui/SubHeader.svelte';
	import { load_page_context } from '../svelte';
    import ContactEdit from './ContactEdit.svelte';

	const {k_page} = load_page_context();

</script>

<style lang="less">
	@import '../_base.less';

	.screen.contacts div.svelte-tabs>div.svelte-tabs__tab-panel {
		:global(&) {
			margin-top: -1px;
		}
	}
</style>

<Screen nav root classNames='contacts'>
	<Header search network account
	>
	</Header>

	<SubHeader title="Contacts"
		on:add_new={() => k_page.push({
			creator: ContactEdit,
		})}
	/>
	<!-- buttons={['Export']} -->
	
	<Tabs>
		<TabList>
			<Tab>
				All
			</Tab>

			<Tab>
				Humans
			</Tab>

			<Tab>
				Contracts
			</Tab>

			<Tab>
				Bots
			</Tab>
		</TabList>


		<!-- All -->
		<TabPanel>
			<ContactList />
		</TabPanel>


		<!-- Humans -->
		<TabPanel>
			<ContactList
				filter={g_contact => ContactAgentType.PERSON === g_contact.agentType}
			/>
		</TabPanel>
		
		<!-- Contracts -->
		<TabPanel>
			<ContactList
				filter={g_contact => ContactAgentType.CONTRACT === g_contact.agentType}
			/>
		</TabPanel>

		<!-- Robots -->
		<TabPanel>
			<ContactList
				filter={g_contact => ContactAgentType.ROBOT === g_contact.agentType}
			/>
		</TabPanel>
	</Tabs>

</Screen>