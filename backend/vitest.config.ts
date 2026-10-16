import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["tests/**/*.test.ts"],
		// Tests assert on log calls through spies; keep the real output quiet.
		env: { LOG_LEVEL: "silent" },
	},
});
