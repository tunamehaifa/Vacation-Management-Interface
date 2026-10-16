import { PASSWORD, TEST_PORT } from "./env";

/** A tiny HTTP client for the tests: status and parsed body, nothing thrown. */
export async function api(
	method: string,
	path: string,
	{ token, body }: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
	const response = await fetch(`http://localhost:${TEST_PORT}${path}`, {
		method,
		headers: {
			"Content-Type": "application/json",
			...(token && { Authorization: `Bearer ${token}` }),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await response.text();
	return { status: response.status, body: text ? JSON.parse(text) : null };
}

export async function login(email: string): Promise<string> {
	const { status, body } = await api("POST", "/auth/login", { body: { email, password: PASSWORD } });
	if (status !== 200) throw new Error(`Login of ${email} failed: ${status}`);
	return body.token;
}

/** "YYYY-MM-DD", `days` after today (UTC, like the API). */
export const day = (days: number): string => {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
};
