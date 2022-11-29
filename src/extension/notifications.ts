import type {AccountPath} from '#/meta/account';
import type {IncidentPath} from '#/meta/incident';
import type {Vocab} from '#/meta/vocab';

import type {ExtToNative} from '#/script/messages';
import {B_IPHONE_IOS} from '#/share/constants';
import {Accounts} from '#/store/accounts';
import {Incidents} from '#/store/incidents';
import {Pfps} from '#/store/pfps';
import {F_NOOP} from '#/util/belt';

export type NotificationRouterRegistry = {
	incident: {
		data: IncidentPath;
	};
};

export type NotificationRouterKey = keyof NotificationRouterRegistry;

export type RoutableNotificationId<
	si_key extends NotificationRouterKey=NotificationRouterKey,
> = {
	[si_each in NotificationRouterKey]: `@${si_each}:${NotificationRouterRegistry[si_each]['data']}`;
}[si_key];

export interface NotifyItemCore {
	title: string;
	message: string;
}

export interface NotifyItemConfig extends NotifyItemCore {
	group?: (nl_msgs: number) => string;
}

export interface NotificationConfig {
	item: NotifyItemCore;
	id?: RoutableNotificationId;
	incident?: IncidentPath;

	/**
	 * If natural number, clears notification after timeout in ms.
	 * If 0 or negative, clears notification after default timeout.
	 * If omitted or Infinite, does not clear notification.
	 */
	timeout?: number;
}


const f_runtime_ios: () => Vocab.TypedRuntime<ExtToNative.MobileVocab> = () => chrome.runtime;

export const system_notify = B_IPHONE_IOS
	? function notify_user(gc_notification: NotificationConfig) {
		const g_message: Vocab.Message<ExtToNative.MobileVocab, 'notify'> = {
			type: 'notify',
			value: gc_notification,
		};

		console.log(g_message);

		f_runtime_ios().sendNativeMessage('application.id', g_message, (w_response) => {
			console.debug(`Received response from native app: %o`, w_response);
		});
	}
	: chrome.notifications
		? async function notify_user(gc_notification: NotificationConfig) {
			let p_icon = '/media/vendor/logo-192px.png';
			const p_incident = gc_notification.incident;
			if(p_incident) {
				try {
					const g_incident = await Incidents.at(p_incident);
					const p_account = g_incident?.data['account'] as AccountPath;
					const g_account = await Accounts.at(p_account);
					const p_default = await Pfps.createUrlFromDefault(g_account!.pfp);
					if(p_default) p_icon = p_default;
				}
				catch(e_account) {}
			}

			chrome.notifications?.create(gc_notification.id || '', {
				type: 'basic',
				priority: 1,
				iconUrl: p_icon,
				eventTime: Date.now(),
				title: gc_notification.item.title || '1 New Notification',
				message: gc_notification.item.message || ' ',
			}, (si_notifcation) => {
				// clear after some timeout
				const xt_timeout = gc_notification.timeout!;
				if(Number.isFinite(xt_timeout) && xt_timeout > 0) {
					setTimeout(() => {
						chrome.notifications?.clear(si_notifcation);
					}, xt_timeout);
				}
			});
		}
		: F_NOOP;
