import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../src/logger";
import { DomainEvent, EventBus } from "../../src/cqrs/event-bus";

class SomethingHappenedEvent extends DomainEvent {
	constructor(readonly id: string) {
		super();
	}
}

class SomethingElseEvent extends DomainEvent {}

describe("EventBus", () => {
	beforeEach(() => {
		vi.spyOn(logger, "info").mockImplementation(() => {});
		vi.spyOn(logger, "error").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

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
		expect(logger.error).toHaveBeenCalledWith(
			{ event: "SomethingHappenedEvent", subscriber: 1, err: expect.any(Error) },
			"event subscriber failed",
		);
	});

	it("is fine with no subscribers", async () => {
		await expect(new EventBus().publish(new SomethingElseEvent())).resolves.toBeUndefined();
	});
});
