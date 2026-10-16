import { APIGatewayProxyStructuredResultV2 } from "commoneventframework";
import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { UserRole } from "../entities/user.entity";
import { ForbiddenError, UnauthorizedError } from "../http/errors";
import { getHeader } from "../http/request";
import { HandlerFn } from "../handlers/types";
import { AuthUser, verifyToken } from "./jwt";

export type AuthorizedHandlerFn<TInput = any> = (
	input: TInput,
	event: CommonEvent,
	user: AuthUser,
) => Promise<APIGatewayProxyStructuredResultV2 | object>;

/**
 * Protects a route: the request needs a valid `Authorization: Bearer <JWT>`
 * (else 401) whose role is one of `roles` (else 403). Only then is the handler
 * called, with the authenticated user as its third argument.
 *
 *   export const approve = authorize([UserRole.Validator], async (input, event, user) => ...);
 */
export const authorize =
	<TInput = any>(roles: readonly UserRole[], handler: AuthorizedHandlerFn<TInput>): HandlerFn =>
	async (input: TInput, event: CommonEvent) => {
		const header = getHeader(event, "authorization");
		const token = header?.match(/^Bearer\s+(\S+)$/i)?.[1];
		if (!token) throw new UnauthorizedError();

		const user = verifyToken(token);
		if (!user) throw new UnauthorizedError("Invalid or expired token");
		if (!roles.includes(user.role)) throw new ForbiddenError();

		return handler(input, event, user);
	};

export const ANY_ROLE: readonly UserRole[] = Object.values(UserRole);
