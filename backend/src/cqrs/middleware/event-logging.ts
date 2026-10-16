import { logger } from "../../logger";
import { EventMiddleware } from "../event-bus";

/**
 * One log entry per delivery of an event to a subscriber: which event, which
 * subscriber, the outcome and how long it took. The event's data is not
 * logged, only its name.
 *
 *   info   { event: "VacationRequestApprovedEvent", subscriber: "recordHistory", outcome: "ok", ms: 3 }
 *   error  { event: "VacationRequestApprovedEvent", subscriber: "notifyRequester", outcome: "ERROR", ms: 1, err }
 *
 * A failure is rethrown so the bus can still tell it apart; the bus keeps it
 * from reaching the other subscribers or the request.
 */
export const eventLoggingMiddleware: EventMiddleware = async (event, subscriber, next) => {
	const startedAt = performance.now();
	const fields = {
		event: event.constructor.name,
		subscriber: subscriber.name || "anonymous subscriber",
	};
	const ms = () => Math.round(performance.now() - startedAt);

	try {
		await next();
		logger.info({ ...fields, outcome: "ok", ms: ms() }, "event");
	} catch (err) {
		logger.error({ ...fields, outcome: "ERROR", ms: ms(), err }, "event subscriber failed");
		throw err;
	}
};
