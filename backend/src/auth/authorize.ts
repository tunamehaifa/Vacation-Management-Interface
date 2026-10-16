import { APIGatewayProxyStructuredResultV2 } from "commoneventframework";
import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { UserRole } from "../entities/user.entity";
import { ForbiddenError, UnauthorizedError } from "../http/errors";
import { getHeader } from "../http/request";
import { HandlerFn } from "../handlers/types";
import { logger } from "../logger";
import { AuthUser, verifyToken } from "./jwt";

export type AuthorizedHandlerFn<TInput = any> = (
	input: TInput,
	event: CommonEvent,
	user: AuthUser,
) => Promise<APIGatewayProxyStructuredResultV2 | object>;

/**
 * Protects a read route: the request needs a valid `Authorization: Bearer <JWT>`
 * (else 401) whose role is one of `roles` (else 403). Only then is the handler
 * called, with the authenticated user as its third argument.
 *
 * Routes that change state use `authenticate` instead and let the CommandBus
 * check roles (see src/cqrs/middleware/authorization.ts).
 *
 *   export const listAll = authorize([UserRole.Validator], async (input, event, user) => ...);
 */
export const authorize =
	<TInput = any>(roles: readonly UserRole[], handler: AuthorizedHandlerFn<TInput>): HandlerFn =>
	async (input: TInput, event: CommonEvent) => {
		const header = getHeader(event, "authorization");
		const token = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
		if (!token) throw new UnauthorizedError();

		// A missing token is routine (signed out); a bad one or a wrong role is worth a warning.
		const user = verifyToken(token);
		if (!user) {
			logger.warn({ auth: "token rejected", failure: "invalid or expired" }, "auth");
			throw new UnauthorizedError("Invalid or expired token");
		}
		if (!roles.includes(user.role)) {
			const failure = `needs ${roles.join(" or ")}`;
			logger.warn({ auth: "forbidden", user: `${user.role}:${user.id}`, failure }, "auth");
			throw new ForbiddenError();
		}

		return handler(input, event, user);
	};

export const ANY_ROLE: readonly UserRole[] = Object.values(UserRole);

/**
 * For routes that send a command: only proves who the caller is (401 without
 * a valid token). Which roles may run the command is declared on the command
 * and enforced by the CommandBus's authorization middleware.
 */
export const authenticate = <TInput = any>(handler: AuthorizedHandlerFn<TInput>): HandlerFn =>
	authorize(ANY_ROLE, handler);
