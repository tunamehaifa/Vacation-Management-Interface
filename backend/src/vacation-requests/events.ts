import { DomainEvent } from "../cqrs/event-bus";
import { VacationRequestView } from "./view";

/**
 * What happened to a vacation request. Published by the command handlers
 * after their transaction commits. `actorId` is the user who caused it.
 */

export class VacationRequestCreatedEvent extends DomainEvent {
	constructor(readonly request: VacationRequestView, readonly actorId: string) {
		super();
	}
}

export class VacationRequestUpdatedEvent extends DomainEvent {
	constructor(readonly request: VacationRequestView, readonly actorId: string) {
		super();
	}
}

export class VacationRequestCancelledEvent extends DomainEvent {
	constructor(readonly request: VacationRequestView, readonly actorId: string) {
		super();
	}
}

export class VacationRequestApprovedEvent extends DomainEvent {
	constructor(readonly request: VacationRequestView, readonly actorId: string) {
		super();
	}
}

export class VacationRequestRejectedEvent extends DomainEvent {
	constructor(readonly request: VacationRequestView, readonly actorId: string) {
		super();
	}
}
