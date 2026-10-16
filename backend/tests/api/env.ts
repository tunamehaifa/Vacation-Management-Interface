/** Shared by the global setup and the tests. */
export const TEST_DB = "vacation_api_test";
export const TEST_PORT = 8897;
export const PASSWORD = "Password123!";

export const USERS = {
	validator: { name: "Vera Validator", email: "validator@test.local", role: "Validator" },
	alice: { name: "Alice Requester", email: "alice@test.local", role: "Requester" },
	bob: { name: "Bob Requester", email: "bob@test.local", role: "Requester" },
} as const;
