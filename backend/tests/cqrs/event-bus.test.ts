import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainEvent, EventBus } from "../../src/cqrs/event-bus";
import { eventLoggingMiddleware } from "../../src/cqrs/middleware/event-logging";
import { logger } from "../../src/logger";

class SomethingHappenedEvent extends DomainEvent {
	constructor(readonly id: string) {
		super();
	}
}

class SomethingElseEvent extends DomainEvent {}

describe("EventBus", () => {
	it("delivers an event to every subscriber of its type, and only those", async () => {
		const first = vi.fn();
		const second = vi.fn();
		const other = vi.fn();
		const bus = new EventBus()
			.subscribe(SomethingHappenedEvent, first)
			.subscribe(SomethingHappenedEvent, second)
			.subscribe(SomethingElseEvent, other);

		const event = new SomethingHappenedEvent("42");
		await bus.publish(event);

		expect(first).toHaveBeenCalledWith(event);
		expect(second).toHaveBeenCalledWith(event);
		expect(other).not.toHaveBeenCalled();
	});

	it("keeps going when a subscriber fails, and does not throw", async () => {
		const after = vi.fn();
		const bus = new EventBus()
			.subscribe(SomethingHappenedEvent, () => {
				throw new Error("mail server down");
			})
			.subscribe(SomethingHappenedEvent, after);

		await expect(bus.publish(new SomethingHappenedEvent("1"))).resolves.toBeUndefined();
		expect(after).toHaveBeenCalled();
	});

	it("runs the middlewares around each delivery, in the order they were added", async () => {
		const calls: string[] = [];
		const bus = new EventBus()
			.use(async (_e, subscriber, next) => (calls.push(`outer:${subscriber.name}`), next()))
			.use(async (_e, subscriber, next) => (calls.push(`inner:${subscriber.name}`), next()))
			.subscribe(SomethingHappenedEvent, function recordHistory() {
				calls.push("recordHistory");
			});

		await bus.publish(new SomethingHappenedEvent("1"));
		expect(calls).toEqual(["outer:recordHistory", "inner:recordHistory", "recordHistory"]);
	});

	it("is fine with no subscribers", async () => {
		await expect(new EventBus().publish(new SomethingElseEvent())).resolves.toBeUndefined();
	});
});

describe("event logging middleware", () => {
	beforeEach(() => {
		vi.spyOn(logger, "info").mockImplementation(() => {});
		vi.spyOn(logger, "error").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("logs each delivery with the event, the subscriber and the outcome", async () => {
		const failure = new Error("mail server down");
		const bus = new EventBus()
			.use(eventLoggingMiddleware)
			.subscribe(SomethingHappenedEvent, function recordHistory() {})
			.subscribe(SomethingHappenedEvent, function notifyRequester() {
				throw failure;
			});

		await bus.publish(new SomethingHappenedEvent("1"));

		expect(logger.info).toHaveBeenCalledWith(
			{ event: "SomethingHappenedEvent", subscriber: "recordHistory", outcome: "ok", ms: expect.any(Number) },
			"event",
		);
		expect(logger.error).toHaveBeenCalledWith(
			{ event: "SomethingHappenedEvent", subscriber: "notifyRequester", outcome: "ERROR", ms: expect.any(Number), err: failure },
			"event subscriber failed",
		);
	});
});
