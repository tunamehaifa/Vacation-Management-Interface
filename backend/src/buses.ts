import { CommandBus } from "./cqrs/command-bus";
import { EventBus } from "./cqrs/event-bus";
import { authorizationMiddleware } from "./cqrs/middleware/authorization";
import { commandLoggingMiddleware } from "./cqrs/middleware/command-logging";
import { eventLoggingMiddleware } from "./cqrs/middleware/event-logging";
import {
	ApproveVacationRequestCommand,
	ApproveVacationRequestHandler,
} from "./vacation-requests/commands/approve-vacation-request";
import {
	CancelVacationRequestCommand,
	CancelVacationRequestHandler,
} from "./vacation-requests/commands/cancel-vacation-request";
import {
	CreateVacationRequestCommand,
	CreateVacationRequestHandler,
} from "./vacation-requests/commands/create-vacation-request";
import {
	RejectVacationRequestCommand,
	RejectVacationRequestHandler,
} from "./vacation-requests/commands/reject-vacation-request";
import {
	UpdateVacationRequestCommand,
	UpdateVacationRequestHandler,
} from "./vacation-requests/commands/update-vacation-request";
import {
	VacationRequestApprovedEvent,
	VacationRequestCancelledEvent,
	VacationRequestCreatedEvent,
	VacationRequestRejectedEvent,
	VacationRequestUpdatedEvent,
} from "./vacation-requests/events";
import { auditLog } from "./vacation-requests/subscribers/audit-log";

/**
 * Composition root: the one place where buses are built, middlewares are
 * ordered and handlers/subscribers are registered. Route handlers import the
 * buses from here and never construct anything themselves.
 *
 * Logging comes first, so refused commands (401/403) are logged too.
 */
export const eventBus = new EventBus().use(eventLoggingMiddleware);

export const commandBus = new CommandBus().use(commandLoggingMiddleware).use(authorizationMiddleware);

commandBus
	.register(CreateVacationRequestCommand, new CreateVacationRequestHandler(eventBus))
	.register(UpdateVacationRequestCommand, new UpdateVacationRequestHandler(eventBus))
	.register(CancelVacationRequestCommand, new CancelVacationRequestHandler(eventBus))
	.register(ApproveVacationRequestCommand, new ApproveVacationRequestHandler(eventBus))
	.register(RejectVacationRequestCommand, new RejectVacationRequestHandler(eventBus));

// Every change of a request is written to the audit log. More reactions
// (a history table, an email to the requester) would be more subscribers here.
eventBus
	.subscribe(VacationRequestCreatedEvent, auditLog)
	.subscribe(VacationRequestUpdatedEvent, auditLog)
	.subscribe(VacationRequestCancelledEvent, auditLog)
	.subscribe(VacationRequestApprovedEvent, auditLog)
	.subscribe(VacationRequestRejectedEvent, auditLog);
