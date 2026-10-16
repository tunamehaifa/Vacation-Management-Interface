import { logger } from "../logger";

/**
 * A domain event records something that already happened
 * (VacationRequestApprovedEvent, ...). Command handlers publish events after
 * their transaction commits; any number of subscribers react to them without
 * the command knowing who they are.
 */
export abstract class DomainEvent {
	readonly occurredAt = new Date();
}

export type EventSubscriber<E extends DomainEvent> = (event: E) => Promise<void> | void;

type EventClass<E extends DomainEvent> = abstract new (...args: any[]) => E;

export class EventBus {
	private readonly subscribers = new Map<Function, EventSubscriber<any>[]>();

	subscribe<E extends DomainEvent>(type: EventClass<E>, subscriber: EventSubscriber<E>): this {
		const list = this.subscribers.get(type) ?? [];
		list.push(subscriber);
		this.subscribers.set(type, list);
		return this;
	}

	/**
	 * Delivers the event to every subscriber. The change it describes is
	 * already committed, so one failing subscriber is logged and does not
	 * stop the others or fail the request.
	 */
	async publish(event: DomainEvent): Promise<void> {
		const name = event.constructor.name;
		const subscribers = this.subscribers.get(event.constructor) ?? [];
		logger.info({ event: name, subscribers: subscribers.length }, "event published");

		const results = await Promise.allSettled(subscribers.map(async (subscriber) => subscriber(event)));
		results.forEach((result, index) => {
			if (result.status === "rejected") {
				logger.error({ event: name, subscriber: index + 1, err: result.reason }, "event subscriber failed");
			}
		});
	}
}
