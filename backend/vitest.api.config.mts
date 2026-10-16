import { defineConfig } from "vitest/config";

/**
 * API integration tests (npm run test:api): real HTTP requests against the
 * real server and a real PostgreSQL database. Needs `docker compose up -d`.
 */
export default defineConfig({
	test: {
		include: ["tests/api/**/*.test.ts"],
		globalSetup: ["tests/api/global-setup.ts"],
		// One server and one database: run the files one after the other.
		fileParallelism: false,
		testTimeout: 15_000,
		hookTimeout: 60_000,
	},
});
