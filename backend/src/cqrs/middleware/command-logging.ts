import { AppError } from "../../http/errors";
import { logger } from "../../logger";
import { CommandMiddleware } from "../command";

/**
 * One log entry per command: what ran, who ran it, the outcome and how long
 * it took. Only names and ids are logged, never the payload, which can hold
 * personal data.
 *
 *   info  { command: "ApproveVacationRequestCommand", actor: "Validator:3f2a…", outcome: "ok", ms: 12 }
 *   warn  { command: "ApproveVacationRequestCommand", actor: "Requester:9b1c…", outcome: "FORBIDDEN", ms: 0 }
 *
 * Expected refusals (AppError: 400/401/403/404/409) are warnings; anything
 * else is an error, logged with its stack.
 */
export const commandLoggingMiddleware: CommandMiddleware = async (command, { actor }, next) => {
	const startedAt = performance.now();
	const fields = {
		command: command.constructor.name,
		actor: actor ? `${actor.role}:${actor.id}` : "anonymous",
	};
	const ms = () => Math.round(performance.now() - startedAt);

	try {
		const result = await next();
		logger.info({ ...fields, outcome: "ok", ms: ms() }, "command");
		return result;
	} catch (err) {
		if (err instanceof AppError) {
			logger.warn({ ...fields, outcome: err.code, ms: ms() }, "command refused");
		} else {
			logger.error({ ...fields, outcome: "ERROR", ms: ms(), err }, "command failed");
		}
		throw err;
	}
};
