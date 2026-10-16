import type { AuthUser } from "../auth/jwt";
import { AppError } from "../http/errors";
import type { Page } from "../http/pagination";
import { logger } from "../logger";

const isPage = (value: unknown): value is Page<unknown> =>
	typeof value === "object" && value !== null && "items" in value && "total" in value;

/**
 * Runs a read and logs it, the way the CommandBus logs commands: which query,
 * who asked, what it found and how long it took. Filters are logged as ids
 * and values, never the rows themselves.
 *
 *   info { query: "allRequests", actor: "Validator:3f2a…", filter: " status=Pending", outcome: "10 of 19, page 1/2", ms: 6 }
 */
export async function loggedQuery<T>(
	query: string,
	user: AuthUser,
	run: () => Promise<T>,
	filters: Record<string, string | number | undefined> = {},
): Promise<T> {
	const startedAt = performance.now();
	const filter = Object.entries(filters)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => ` ${key}=${value}`)
		.join("");
	const fields = { query, actor: `${user.role}:${user.id}`, filter };
	const ms = () => Math.round(performance.now() - startedAt);

	try {
		const result = await run();
		const outcome = isPage(result)
			? `${result.items.length} of ${result.total}, page ${result.page}/${Math.max(result.totalPages, 1)}`
			: "ok";
		logger.info({ ...fields, outcome, ms: ms() }, "query");
		return result;
	} catch (err) {
		if (err instanceof AppError) logger.warn({ ...fields, outcome: err.code, ms: ms() }, "query refused");
		else logger.error({ ...fields, outcome: "ERROR", ms: ms(), err }, "query failed");
		throw err;
	}
}
