import { CommandBus } from "./cqrs/command-bus";
import { EventBus } from "./cqrs/event-bus";
import { authorizationMiddleware } from "./cqrs/middleware/authorization";
import { commandLoggingMiddleware } from "./cqrs/middleware/command-logging";
import { eventLoggingMiddleware } from "./cqrs/middleware/event-logging";

/**
 * Composition root: the one place where buses are built, middlewares are
 * ordered and handlers/subscribers are registered. Route handlers import the
 * buses from here and never construct anything themselves.
 *
 * Logging comes first, so refused commands (401/403) are logged too.
 */
export const eventBus = new EventBus().use(eventLoggingMiddleware);

export const commandBus = new CommandBus().use(commandLoggingMiddleware).use(authorizationMiddleware);

// Command handlers and event subscribers are registered here as features land, e.g.
//   commandBus.register(ApproveVacationRequestCommand, new ApproveVacationRequestHandler(eventBus));
//   eventBus.subscribe(VacationRequestApprovedEvent, recordHistory);
