import { z } from "zod";
import { ANY_ROLE, authorize } from "../auth/authorize";
import { ValidationError } from "../http/errors";
import { parseQuery } from "../http/request";
import { listTeamVacations } from "../vacation-requests/queries";
import { todayUtc } from "../vacation-requests/rules";
import { InputParserFn } from "./types";

// --- GET /team/vacations?from=&to= (both roles) ---

const DEFAULT_DAYS = 90;
const MAX_DAYS = 366;

const isoDate = z.iso.date("Must be a date in YYYY-MM-DD format");
const windowSchema = z.object({ from: isoDate.optional(), to: isoDate.optional() });

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
	return { from, to };
};

export const getTeamVacations = authorize(ANY_ROLE, async (input: { from: string; to: string }, _event, user) => ({
	from: input.from,
	to: input.to,
	items: await listTeamVacations(input.from, input.to, user),
}));
