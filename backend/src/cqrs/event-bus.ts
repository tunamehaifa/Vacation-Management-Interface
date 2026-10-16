/**
 * A domain event records something that already happened
 * (VacationRequestApprovedEvent, ...). Command handlers publish events after
 * their transaction commits; any number of subscribers react to them without
 * the command knowing who they are.
 */
export abstract class DomainEvent {
	readonly occurredAt = new Date();
}

/** Reacts to one event type. Use a named function: its name appears in the logs. */
export type EventSubscriber<E extends DomainEvent> = (event: E) => Promise<void> | void;

/**
 * Runs around each delivery of an event to one subscriber, like the command
 * middlewares run around a command handler. Call `next()` to deliver.
 */
export type EventMiddleware = (
	event: DomainEvent,
	subscriber: EventSubscriber<any>,
	next: () => Promise<void>,
) => Promise<void>;

type EventClass<E extends DomainEvent> = abstract new (...args: any[]) => E;

export class EventBus {
	private readonly subscribers = new Map<Function, EventSubscriber<any>[]>();
	private readonly middlewares: EventMiddleware[] = [];

	use(middleware: EventMiddleware): this {
		this.middlewares.push(middleware);
		return this;
	}

	subscribe<E extends DomainEvent>(type: EventClass<E>, subscriber: EventSubscriber<E>): this {
		const list = this.subscribers.get(type) ?? [];
		list.push(subscriber);
		this.subscribers.set(type, list);
		return this;
	}

	/**
	 * Delivers the event to every subscriber, each through the middleware
	 * pipeline. The change the event describes is already committed, so a
	 * failing subscriber does not stop the others or fail the request; the
	 * logging middleware is what reports it.
	 */
	async publish(event: DomainEvent): Promise<void> {
		const subscribers = this.subscribers.get(event.constructor) ?? [];
		await Promise.allSettled(subscribers.map(async (subscriber) => this.deliver(event, subscriber)));
	}

	private deliver(event: DomainEvent, subscriber: EventSubscriber<any>): Promise<void> {
		const callSubscriber = async () => {
			await subscriber(event);
		};
		const pipeline = this.middlewares.reduceRight<() => Promise<void>>(
			(next, middleware) => () => middleware(event, subscriber, next),
			callSubscriber,
		);
		return pipeline();
	}
}
