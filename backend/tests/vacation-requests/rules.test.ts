import { describe, expect, it } from "vitest";
import { VacationRequestStatus } from "../../src/entities/vacation-request.entity";
import { ConflictError, ValidationError } from "../../src/http/errors";
import {
	assertNoOverlap,
	assertNotStarted,
	assertPending,
	assertValidPeriod,
	requireRejectionComment,
	todayUtc,
} from "../../src/vacation-requests/rules";

const TODAY = "2026-10-16";

describe("rule 1: end date after start date", () => {
	it("accepts an end date after the start date", () => {
		expect(() => assertValidPeriod("2026-11-01", "2026-11-02", TODAY)).not.toThrow();
	});

	it("rejects the same day (strictly after, as the assignment says)", () => {
		expect(() => assertValidPeriod("2026-11-01", "2026-11-01", TODAY)).toThrow(ValidationError);
	});

	it("rejects an end date before the start date", () => {
		expect(() => assertValidPeriod("2026-11-05", "2026-11-01", TODAY)).toThrow(/End date must be after start date/);
	});
});

describe("rule 4: no requests in the past", () => {
	it("accepts a vacation starting today", () => {
		expect(() => assertValidPeriod(TODAY, "2026-10-20", TODAY)).not.toThrow();
	});

	it("rejects a vacation that started yesterday", () => {
		expect(() => assertValidPeriod("2026-10-15", "2026-10-20", TODAY)).toThrow(/cannot start in the past/);
	});

	it("a Pending request can be approved up to its start day", () => {
		expect(() => assertNotStarted({ startDate: TODAY }, TODAY)).not.toThrow();
	});

	it("a Pending request whose start date has passed cannot be approved", () => {
		expect(() => assertNotStarted({ startDate: "2026-10-15" }, TODAY)).toThrow(ConflictError);
	});

	it("today is the UTC calendar day", () => {
		expect(todayUtc(new Date("2026-10-16T23:30:00Z"))).toBe("2026-10-16");
		expect(todayUtc(new Date("2026-10-17T00:10:00Z"))).toBe("2026-10-17");
	});
});

describe("rule 2: no overlapping requests", () => {
	it("passes when nothing overlaps", () => {
		expect(() => assertNoOverlap([])).not.toThrow();
	});

	it("fails with 409 and names the conflicting period", () => {
		const check = () => assertNoOverlap([{ startDate: "2026-11-01", endDate: "2026-11-05" }]);
		expect(check).toThrow(ConflictError);
		expect(check).toThrow("This period overlaps another request (2026-11-01 – 2026-11-05)");
	});
});

describe("rule 3: only Pending requests can change", () => {
	it("allows acting on a Pending request", () => {
		expect(() => assertPending({ status: VacationRequestStatus.Pending }, "modify")).not.toThrow();
	});

	it.each([VacationRequestStatus.Approved, VacationRequestStatus.Rejected])(
		"refuses to touch a %s request (409)",
		(status) => {
			const check = () => assertPending({ status }, "modify");
			expect(check).toThrow(ConflictError);
			expect(check).toThrow(`Cannot modify a request that is already ${status.toLowerCase()}`);
		},
	);
});

describe("rule 5: rejection needs a comment", () => {
	it("returns the comment trimmed", () => {
		expect(requireRejectionComment("  Release week  ")).toBe("Release week");
	});

	it.each([undefined, null, "", "   "])("refuses %j", (comment) => {
		expect(() => requireRejectionComment(comment)).toThrow(ValidationError);
	});
});
