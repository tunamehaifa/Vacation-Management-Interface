import { describe, expect, it } from "vitest";
import { paginationSchema, toPage, toSkipTake } from "../../src/http/pagination";

describe("pagination", () => {
	it("defaults to the first page of 10", () => {
		expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 10 });
	});

	it("reads page and limit from query strings", () => {
		expect(paginationSchema.parse({ page: "3", limit: "25" })).toEqual({ page: 3, limit: 25 });
	});

	it.each([
		["page 0", { page: "0" }],
		["a negative limit", { limit: "-5" }],
		["a limit over 100", { limit: "101" }],
		["a fractional page", { page: "1.5" }],
		["text", { page: "abc" }],
	])("rejects %s", (_label, query) => {
		expect(paginationSchema.safeParse(query).success).toBe(false);
	});

	it("turns a page into skip/take", () => {
		expect(toSkipTake({ page: 1, limit: 10 })).toEqual({ skip: 0, take: 10 });
		expect(toSkipTake({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
	});

	it("builds the response with the page count", () => {
		expect(toPage(["a", "b"], 21, { page: 3, limit: 10 })).toEqual({
			items: ["a", "b"],
			page: 3,
			limit: 10,
			total: 21,
			totalPages: 3,
		});
		expect(toPage([], 0, { page: 1, limit: 10 }).totalPages).toBe(0);
	});
});
