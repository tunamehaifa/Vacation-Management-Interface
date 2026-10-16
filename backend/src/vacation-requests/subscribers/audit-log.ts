import { DomainEvent } from "../../cqrs/event-bus";
import { logger } from "../../logger";
import {
	VacationRequestApprovedEvent,
	VacationRequestCancelledEvent,
	VacationRequestCreatedEvent,
	VacationRequestRejectedEvent,
	VacationRequestUpdatedEvent,
} from "../events";

type VacationRequestEvent =
	| VacationRequestCreatedEvent
	| VacationRequestUpdatedEvent
	| VacationRequestCancelledEvent
	| VacationRequestApprovedEvent
	| VacationRequestRejectedEvent;

const changes = new Map<Function, string>([
	[VacationRequestCreatedEvent, "created"],
	[VacationRequestUpdatedEvent, "updated"],
	[VacationRequestCancelledEvent, "cancelled"],
	[VacationRequestApprovedEvent, "approved"],
	[VacationRequestRejectedEvent, "rejected"],
]);

/**
 * Audit trail in the logs: one business-level entry per change of a request,
 * written by an event subscriber, so the commands do not know it exists.
 *
 *   info { audit: "approved", request: "3f2a…", actor: "9b1c…", period: "2026-11-03..2026-11-05" }
 *
 * Only ids and dates are logged; the reason and the rejection comment can be
 * personal. A history table would be one more subscriber to the same events.
 */
export function auditLog(event: DomainEvent): void {
	const { request, actorId } = event as VacationRequestEvent;
	logger.info(
		{
			audit: changes.get(event.constructor) ?? event.constructor.name,
			request: request.id,
			actor: actorId,
			period: `${request.startDate}..${request.endDate}`,
		},
		"vacation request",
	);
}
