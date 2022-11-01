import type {IncidentPath} from '#/meta/incident';

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
