import { QueryFailedError } from "typeorm";
import { ConflictError, ValidationError } from "../http/errors";
import { logger } from "../logger";

/**
 * The rules are checked in code first, so a constraint violation only happens
 * in a race (two overlapping requests at the same moment). Translate it into
 * the same error the rule would have thrown, instead of a 500.
 */
const byConstraint: Record<string, () => Error> = {
	excl_vacation_requests_no_overlap: () => new ConflictError("This period overlaps another request"),
	chk_vacation_requests_end_after_start: () => new ValidationError("End date must be after start date"),
	chk_vacation_requests_rejection_has_comment: () =>
		new ValidationError("A comment is required when rejecting a request"),
};

export async function translateConstraintErrors<T>(work: () => Promise<T>): Promise<T> {
	try {
		return await work();
	} catch (err) {
		const constraint = err instanceof QueryFailedError ? (err.driverError as { constraint?: string }).constraint : undefined;
		const translated = constraint ? byConstraint[constraint] : undefined;
		if (!translated) throw err;
		// The check in code had passed, so this was a race that the database stopped.
		logger.warn({ constraint }, "database constraint");
		throw translated();
	}
}
