import { beforeAll, describe, expect, it } from "vitest";
import { api, day, login } from "./client";
import { USERS } from "./env";

/**
 * The requester → validator flow through the real API, with the six business
 * rules and pagination. Tests in a file run in order and share the database,
 * so each one uses its own dates.
 */
let alice: string;
let bob: string;
let validator: string;

beforeAll(async () => {
	[alice, bob, validator] = await Promise.all([
		login(USERS.alice.email),
		login(USERS.bob.email),
		login(USERS.validator.email),
	]);
});

const create = (token: string, startDate: string, endDate: string, reason: string | null = null) =>
	api("POST", "/vacation-requests", { token, body: { startDate, endDate, reason } });

describe("submitting a request", () => {
	it("creates a Pending request", async () => {
		const { status, body } = await create(alice, day(10), day(12), "Family trip");
		expect(status).toBe(201);
		expect(body).toMatchObject({ startDate: day(10), endDate: day(12), reason: "Family trip", status: "Pending" });
	});

	it("rule 1: the end date must be after the start date", async () => {
		const { status, body } = await create(alice, day(20), day(20));
		expect(status).toBe(400);
		expect(body.error.details).toEqual([{ field: "endDate", message: expect.any(String) }]);
	});

	it("rule 4: a request cannot start in the past", async () => {
		const { status, body } = await create(alice, day(-1), day(3));
		expect(status).toBe(400);
		expect(body.error.details).toEqual([{ field: "startDate", message: expect.any(String) }]);
	});

	it("rule 2: requests of one user cannot overlap", async () => {
		const { status } = await create(alice, day(12), day(14)); // shares day 12 with "Family trip"
		expect(status).toBe(409);
	});

	it("rule 2: other users may take the same days", async () => {
		expect((await create(bob, day(10), day(12))).status).toBe(201);
	});

	it("rule 2 holds under concurrency: one of five identical requests wins", async () => {
		const results = await Promise.all(Array.from({ length: 5 }, () => create(bob, day(30), day(32))));
		expect(results.map((result) => result.status).sort()).toEqual([201, 409, 409, 409, 409]);
	});

	it("validates the input", async () => {
		const { status } = await api("POST", "/vacation-requests", { token: alice, body: { startDate: "tomorrow" } });
		expect(status).toBe(400);
	});

	it("only requesters submit requests", async () => {
		expect((await create(validator, day(40), day(41))).status).toBe(403);
	});
});

describe("deciding a request", () => {
	let pendingId: string;

	beforeAll(async () => {
		pendingId = (await create(alice, day(50), day(52))).body.id;
	});

	it("rule 6: a requester cannot approve or reject", async () => {
		expect((await api("POST", `/vacation-requests/${pendingId}/approve`, { token: alice })).status).toBe(403);
		const reject = await api("POST", `/vacation-requests/${pendingId}/reject`, { token: bob, body: { comment: "No" } });
		expect(reject.status).toBe(403);
	});

	it("rule 5: a rejection needs a comment", async () => {
		const { status } = await api("POST", `/vacation-requests/${pendingId}/reject`, {
			token: validator,
			body: { comment: "   " },
		});
		expect(status).toBe(400);
	});

	it("a validator approves a Pending request", async () => {
		const { status, body } = await api("POST", `/vacation-requests/${pendingId}/approve`, { token: validator });
		expect(status).toBe(200);
		expect(body.status).toBe("Approved");
		// Like the list, the response says whose request it is.
		expect(body.user).toEqual({ id: expect.any(String), name: USERS.alice.name });
	});

	it("rule 3: an approved request cannot be edited, cancelled or decided again", async () => {
		const edit = await api("PUT", `/vacation-requests/${pendingId}`, {
			token: alice,
			body: { startDate: day(60), endDate: day(61), reason: null },
		});
		expect(edit.status).toBe(409);
		expect((await api("DELETE", `/vacation-requests/${pendingId}`, { token: alice })).status).toBe(409);
		expect((await api("POST", `/vacation-requests/${pendingId}/approve`, { token: validator })).status).toBe(409);
	});

	it("a validator rejects with a comment, which the requester then sees", async () => {
		const id = (await create(alice, day(70), day(71))).body.id;
		const { status, body } = await api("POST", `/vacation-requests/${id}/reject`, {
			token: validator,
			body: { comment: "Release week" },
		});
		expect(status).toBe(200);
		expect(body).toMatchObject({ status: "Rejected", comments: "Release week", user: { name: USERS.alice.name } });

		const mine = await api("GET", "/vacation-requests/mine?limit=100", { token: alice });
		expect(mine.body.items.find((item: { id: string }) => item.id === id).comments).toBe("Release week");
	});

	it("a requester cannot touch someone else's request (404, not 403)", async () => {
		const bobsId = (await create(bob, day(80), day(81))).body.id;
		const edit = await api("PUT", `/vacation-requests/${bobsId}`, {
			token: alice,
			body: { startDate: day(82), endDate: day(83), reason: null },
		});
		expect(edit.status).toBe(404);
		expect((await api("DELETE", `/vacation-requests/${bobsId}`, { token: alice })).status).toBe(404);
	});

	it("a requester edits and cancels their own Pending request", async () => {
		const id = (await create(alice, day(90), day(91))).body.id;
		const edit = await api("PUT", `/vacation-requests/${id}`, {
			token: alice,
			body: { startDate: day(92), endDate: day(94), reason: "Moved" },
		});
		expect(edit.status).toBe(200);
		expect(edit.body).toMatchObject({ startDate: day(92), endDate: day(94), reason: "Moved" });
		expect((await api("DELETE", `/vacation-requests/${id}`, { token: alice })).status).toBe(204);
	});
});

describe("listing and pagination", () => {
	beforeAll(async () => {
		// Five more requests for Bob, a week apart, so there is something to page through.
		for (let i = 0; i < 5; i++) await create(bob, day(100 + i * 7), day(101 + i * 7));
	});

	it("pages through all requests without repeating or skipping any", async () => {
		const first = await api("GET", "/vacation-requests?page=1&limit=4", { token: validator });
		expect(first.status).toBe(200);
		const { total, totalPages } = first.body;
		expect(totalPages).toBe(Math.ceil(total / 4));

		const ids: string[] = [];
		for (let page = 1; page <= totalPages; page++) {
			const { body } = await api("GET", `/vacation-requests?page=${page}&limit=4`, { token: validator });
			ids.push(...body.items.map((item: { id: string }) => item.id));
		}
		expect(ids).toHaveLength(total);
		expect(new Set(ids).size).toBe(total);
	});

	it("a page past the end is empty, not an error", async () => {
		const { status, body } = await api("GET", "/vacation-requests?page=999&limit=10", { token: validator });
		expect(status).toBe(200);
		expect(body.items).toEqual([]);
	});

	it("rejects invalid paging", async () => {
		expect((await api("GET", "/vacation-requests?page=0", { token: validator })).status).toBe(400);
		expect((await api("GET", "/vacation-requests?limit=101", { token: validator })).status).toBe(400);
	});

	it("filters by status and by user", async () => {
		const me = await api("GET", "/auth/me", { token: bob });
		const { body } = await api("GET", `/vacation-requests?status=Pending&userId=${me.body.id}&limit=100`, {
			token: validator,
		});
		expect(body.total).toBeGreaterThan(0);
		expect(body.items.every((item: any) => item.status === "Pending" && item.user.id === me.body.id)).toBe(true);
	});

	it("my requests contain only my own", async () => {
		const me = await api("GET", "/auth/me", { token: alice });
		const { body } = await api("GET", "/vacation-requests/mine?limit=100", { token: alice });
		const all = await api("GET", `/vacation-requests?userId=${me.body.id}&limit=100`, { token: validator });
		expect(body.total).toBe(all.body.total);
	});
});

describe("team planning", () => {
	it("shows colleagues' dates but hides their reasons from a requester", async () => {
		const { status, body } = await api("GET", `/team/vacations?from=${day(10)}&to=${day(12)}`, { token: bob });
		expect(status).toBe(200);
		const alicesTrip = body.items.find((item: any) => item.user.name === USERS.alice.name);
		expect(alicesTrip).toMatchObject({ startDate: day(10), reason: null });
	});

	it("validators see the reasons", async () => {
		const { body } = await api("GET", `/team/vacations?from=${day(10)}&to=${day(12)}`, { token: validator });
		const alicesTrip = body.items.find((item: any) => item.user.name === USERS.alice.name);
		expect(alicesTrip.reason).toBe("Family trip");
	});
});
