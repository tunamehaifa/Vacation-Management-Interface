import { z } from "zod";
import { ANY_ROLE, authorize } from "../auth/authorize";
import { ValidationError } from "../http/errors";
import { paginationSchema } from "../http/pagination";
import { parseQuery } from "../http/request";
import { listTeamVacations } from "../vacation-requests/queries";
import { todayUtc } from "../vacation-requests/rules";
import { loggedQuery } from "./logged-query";
import { InputParserFn } from "./types";

// --- GET /team/vacations?from=&to=&page=&limit= (both roles) ---

const DEFAULT_DAYS = 90;
const MAX_DAYS = 366;

const isoDate = z.iso.date("Must be a date in YYYY-MM-DD format");
const windowSchema = paginationSchema.extend({ from: isoDate.optional(), to: isoDate.optional() });

const addDays = (date: string, days: number): string => {
	const result = new Date(`${date}T00:00:00Z`);
	result.setUTCDate(result.getUTCDate() + days);
	return result.toISOString().slice(0, 10);
};

/** Defaults to the next 90 days from today; at most one year at a time. */
export const parseTeamInput: InputParserFn = (event) => {
	const query = parseQuery(event, windowSchema);
	const from = query.from ?? todayUtc();
	const to = query.to ?? addDays(from, DEFAULT_DAYS);

	if (to < from) throw new ValidationError("`to` must not be before `from`");
	if (to > addDays(from, MAX_DAYS)) throw new ValidationError(`The window can be at most ${MAX_DAYS} days`);
	return { from, to, page: query.page, limit: query.limit };
};

type TeamInput = { from: string; to: string; page: number; limit: number };

/** One page of people away in the window (see listTeamVacations), plus the window itself. */
export const getTeamVacations = authorize(ANY_ROLE, async ({ from, to, page, limit }: TeamInput, _event, user) => ({
	from,
	to,
	...(await loggedQuery("teamVacations", user, () => listTeamVacations(from, to, user, { page, limit }), { from, to })),
}));
