import { VacationRequest, VacationRequestStatus } from "../entities/vacation-request.entity";
import { ConflictError, ValidationError } from "../http/errors";

/**
 * The business rules of a vacation request, as plain functions with no
 * database access, so they are easy to read and to unit-test. Command
 * handlers call them; the database constraints (see the migrations) repeat
 * rules 1, 2 and 5 as a last line of defence.
 *
 * Dates are calendar days as "YYYY-MM-DD" strings, which compare correctly
 * as plain strings.
 */

/** Today's date, "YYYY-MM-DD", in UTC (see README, known limitations). */
export const todayUtc = (now = new Date()): string => now.toISOString().slice(0, 10);

/**
 * Rule 1: the end date must be after the start date.
 * Rule 4: requests in the past are not allowed (starting today is fine).
 */
export function assertValidPeriod(startDate: string, endDate: string, today: string): void {
	if (endDate <= startDate) {
		throw new ValidationError("End date must be after start date", [
			{ field: "endDate", message: "Must be after the start date" },
		]);
	}
	if (startDate < today) {
		throw new ValidationError("Vacation requests cannot start in the past", [
			{ field: "startDate", message: "Must be today or later" },
		]);
	}
}

/**
 * Rule 2: requests of the same user must not overlap. `existing` are the
 * user's other Pending/Approved requests that overlap the period (the query
 * finds them; this turns the finding into an error).
 */
export function assertNoOverlap(existing: Pick<VacationRequest, "startDate" | "endDate">[]): void {
	if (existing.length > 0) {
		const [first] = existing;
		throw new ConflictError(
			`This period overlaps another request (${first.startDate} – ${first.endDate})`,
			existing.map(({ startDate, endDate }) => ({ startDate, endDate })),
		);
	}
}

/**
 * Rule 3: approved requests cannot be modified. More precisely, only a
 * Pending request can be edited, cancelled, approved or rejected; once
 * decided, it is final.
 */
export function assertPending(request: Pick<VacationRequest, "status">, action: string): void {
	if (request.status !== VacationRequestStatus.Pending) {
		throw new ConflictError(`Cannot ${action} a request that is already ${request.status.toLowerCase()}`);
	}
}

/**
 * Rule 4, when deciding: a request that waited in Pending until its start
 * date passed cannot be approved, as that would approve days in the past.
 * It can still be rejected, or moved to new dates by the requester.
 */
export function assertNotStarted(request: Pick<VacationRequest, "startDate">, today: string): void {
	if (request.startDate < today) {
		throw new ConflictError("Cannot approve a request whose start date has passed; reject it instead");
	}
}

/** Rule 5: a rejected request must contain a rejection comment. Returns it trimmed. */
export function requireRejectionComment(comment: string | undefined | null): string {
	const trimmed = comment?.trim() ?? "";
	if (!trimmed) {
		throw new ValidationError("A comment is required when rejecting a request", [
			{ field: "comment", message: "Required" },
		]);
	}
	return trimmed;
}

// Rule 6 (only validators approve or reject) is declared on the commands
// themselves: `static access = [UserRole.Validator]`, enforced by the
// CommandBus's authorization middleware.
