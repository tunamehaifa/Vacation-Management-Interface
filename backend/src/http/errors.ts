import { Response } from "commoneventframework";
import { logger } from "../logger";

/**
 * Errors that carry their HTTP status. Parsers, handlers and commands throw
 * them; the entry point turns them into one uniform response shape:
 *   { "error": { "code": "...", "message": "...", "details"?: ... } }
 */
export class AppError extends Error {
	constructor(
		readonly statusCode: number,
		readonly code: string,
		message: string,
		readonly details?: unknown,
	) {
		super(message);
		this.name = new.target.name;
	}
}

export class ValidationError extends AppError {
	constructor(message: string, details?: unknown) {
		super(400, "VALIDATION_ERROR", message, details);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message = "Authentication required") {
		super(401, "UNAUTHORIZED", message);
	}
}

export class ForbiddenError extends AppError {
	constructor(message = "You are not allowed to perform this action") {
		super(403, "FORBIDDEN", message);
	}
}

export class NotFoundError extends AppError {
	constructor(message = "Resource not found") {
		super(404, "NOT_FOUND", message);
	}
}

export class ConflictError extends AppError {
	constructor(message: string, details?: unknown) {
		super(409, "CONFLICT", message, details);
	}
}

/**
 * Known errors keep their status and message. Anything else is logged and
 * answered with a generic 500, so stack traces and SQL never reach the client.
 */
export const toErrorResponse = (err: unknown): Response => {
	if (err instanceof AppError) {
		return new Response(err.statusCode, {
			error: { code: err.code, message: err.message, details: err.details },
		});
	}
	logger.error({ err }, "unhandled error");
	return new Response(500, { error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
};
