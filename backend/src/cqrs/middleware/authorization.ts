import { ForbiddenError, UnauthorizedError } from "../../http/errors";
import { CommandClass, CommandMiddleware } from "../command";

/**
 * Role-based access control for every command. Each command class declares
 * `static access`; this middleware enforces it before the handler runs,
 * whatever the entry point (HTTP, a queue, a test).
 *
 * Fails closed: a command that forgot to declare access is never run.
 */
export const authorizationMiddleware: CommandMiddleware = async (command, { actor }, next) => {
	const { name, access } = command.constructor as CommandClass;

	if (access === undefined) {
		throw new Error(`${name} does not declare who may run it (static access)`);
	}
	if (access !== "public") {
		if (!actor) throw new UnauthorizedError();
		if (!access.includes(actor.role)) throw new ForbiddenError();
	}
	return next();
};
