import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		// The API tests need a database and run separately (vitest.api.config.mts).
		exclude: ["tests/api/**"],
		// Tests assert on log calls through spies; keep the real output quiet.
		env: { LOG_LEVEL: "silent" },
	},
});
