import { describe, expect, it } from "vitest";
import { api, login } from "./client";
import { PASSWORD, USERS } from "./env";

describe("authentication", () => {
	it("returns a token and the user for valid credentials", async () => {
		const { status, body } = await api("POST", "/auth/login", {
			body: { email: USERS.alice.email, password: PASSWORD },
		});
		expect(status).toBe(200);
		expect(body.token).toEqual(expect.any(String));
		expect(body.user).toMatchObject({ email: USERS.alice.email, role: "Requester" });
		expect(body.user).not.toHaveProperty("password");
	});

	it("gives the same 401 for a wrong password and an unknown email", async () => {
		const wrongPassword = await api("POST", "/auth/login", { body: { email: USERS.alice.email, password: "nope" } });
		const unknownEmail = await api("POST", "/auth/login", { body: { email: "nobody@test.local", password: "nope" } });
		expect(wrongPassword.status).toBe(401);
		expect(unknownEmail.status).toBe(401);
		expect(wrongPassword.body).toEqual(unknownEmail.body);
	});

	it("validates the login body", async () => {
		const { status, body } = await api("POST", "/auth/login", { body: { email: "not-an-email" } });
		expect(status).toBe(400);
		expect(body.error.code).toBe("VALIDATION_ERROR");
	});

	it("protects routes: no token or a bad token is 401", async () => {
		expect((await api("GET", "/vacation-requests/mine")).status).toBe(401);
		expect((await api("GET", "/vacation-requests/mine", { token: "not.a.jwt" })).status).toBe(401);
	});

	it("GET /auth/me returns the signed-in user", async () => {
		const { status, body } = await api("GET", "/auth/me", { token: await login(USERS.validator.email) });
		expect(status).toBe(200);
		expect(body).toMatchObject({ email: USERS.validator.email, role: "Validator" });
	});

	it("checks roles: a requester cannot list all requests", async () => {
		const { status } = await api("GET", "/vacation-requests", { token: await login(USERS.alice.email) });
		expect(status).toBe(403);
	});
});
