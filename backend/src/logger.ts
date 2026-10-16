import pino from "pino";

/**
 * The one logger of the backend (HTTP access log, command and event buses).
 *
 * - Local dev server (`npm run dev`, started with --local): human-readable
 *   output through pino-pretty.
 * - Lambda bundle: plain JSON lines, which CloudWatch can search and filter.
 *   pino-pretty runs in a worker thread that a single-file esbuild bundle
 *   cannot ship, so it is only used locally (it is a devDependency).
 *
 * LOG_LEVEL overrides the level (default "info"; "silent" turns logging off).
 */
const pretty = process.argv.includes("--local");

// Locally, each entry becomes one line built from its fields, e.g.
//   12:27:48 INFO: http POST /auth/login → 401 (89 ms)
//   12:27:49 WARN: command refused ApproveVacationRequestCommand by Requester:9b1c… → FORBIDDEN (0 ms)
//   12:27:49 INFO: event VacationRequestApprovedEvent → recordHistory: ok (3 ms)
// The fields used here are hidden from the object dump; anything else (an error's stack) still prints.
const lineFields = ["method", "path", "status", "command", "actor", "outcome", "event", "subscriber", "ms"];
const lineFormat =
	"{msg}" +
	"{if method} {method} {path} → {status} ({ms} ms){end}" +
	"{if command} {command} by {actor} → {outcome} ({ms} ms){end}" +
	"{if event} {event} → {subscriber}: {outcome} ({ms} ms){end}";

export const logger = pino({
	level: process.env.LOG_LEVEL || "info",
	...(pretty && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "HH:MM:ss",
				messageFormat: lineFormat,
				ignore: ["pid", "hostname", ...lineFields].join(","),
			},
		},
	}),
});
