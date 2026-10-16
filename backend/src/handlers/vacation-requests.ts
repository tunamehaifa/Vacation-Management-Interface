import { Response } from "commoneventframework";
import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { z } from "zod";
import { authenticate, authorize } from "../auth/authorize";
import { commandBus } from "../buses";
import { UserRole } from "../entities/user.entity";
import { VacationRequestStatus } from "../entities/vacation-request.entity";
import { paginationSchema } from "../http/pagination";
import { parseBody, parseIdParam, parseQuery } from "../http/request";
import { ApproveVacationRequestCommand } from "../vacation-requests/commands/approve-vacation-request";
import { CancelVacationRequestCommand } from "../vacation-requests/commands/cancel-vacation-request";
import { CreateVacationRequestCommand } from "../vacation-requests/commands/create-vacation-request";
import { RejectVacationRequestCommand } from "../vacation-requests/commands/reject-vacation-request";
import { UpdateVacationRequestCommand } from "../vacation-requests/commands/update-vacation-request";
import { getRequest, listAllRequests, listMyRequests } from "../vacation-requests/queries";
import { loggedQuery } from "./logged-query";
import { InputParserFn } from "./types";

/**
 * HTTP layer for vacation requests: parse and validate the input, then send a
 * command (writes) or call a query (reads). Business rules live in the
 * commands and in ../vacation-requests/rules.ts, not here.
 */

const isoDate = z.iso.date("Must be a date in YYYY-MM-DD format");

// Optional reason: blank becomes null.
const reason = z
	.string()
	.trim()
	.max(500)
	.nullish()
	.transform((value) => value || null);

const periodSchema = z.object({ startDate: isoDate, endDate: isoDate, reason });

// --- POST /vacation-requests (Requester) ---

export const parseCreateInput: InputParserFn = (event) => parseBody(event, periodSchema);

export const createRequest = authenticate(async (input: z.infer<typeof periodSchema>, _event, actor) => {
	const request = await commandBus.execute(
		new CreateVacationRequestCommand(input.startDate, input.endDate, input.reason),
		{ actor },
	);
	return new Response(201, request);
});

// --- PUT /vacation-requests/:id (Requester, own Pending request) ---

export const parseUpdateInput: InputParserFn = (event: CommonEvent) => ({
	id: parseIdParam(event),
	...parseBody(event, periodSchema),
});

export const updateRequest = authenticate(
	async (input: { id: string } & z.infer<typeof periodSchema>, _event, actor) =>
		commandBus.execute(
			new UpdateVacationRequestCommand(input.id, input.startDate, input.endDate, input.reason),
			{ actor },
		),
);

// --- DELETE /vacation-requests/:id (Requester, own Pending request) ---

export const parseIdInput: InputParserFn = (event) => ({ id: parseIdParam(event) });

export const cancelRequest = authenticate(async (input: { id: string }, _event, actor) => {
	await commandBus.execute(new CancelVacationRequestCommand(input.id), { actor });
	// 204 No Content: Node never sends a body with it.
	return new Response(204, {});
});

// --- POST /vacation-requests/:id/approve (Validator) ---

export const approveRequest = authenticate(async (input: { id: string }, _event, actor) =>
	commandBus.execute(new ApproveVacationRequestCommand(input.id), { actor }),
);

// --- POST /vacation-requests/:id/reject (Validator) ---

const rejectSchema = z.object({ comment: z.string().trim().min(1, "A comment is required").max(1000) });

export const parseRejectInput: InputParserFn = (event) => ({
	id: parseIdParam(event),
	...parseBody(event, rejectSchema),
});

export const rejectRequest = authenticate(
	async (input: { id: string } & z.infer<typeof rejectSchema>, _event, actor) =>
		commandBus.execute(new RejectVacationRequestCommand(input.id, input.comment), { actor }),
);

// --- GET /vacation-requests/mine?page=&limit= (Requester) ---

export const parseMineInput: InputParserFn = (event) => parseQuery(event, paginationSchema);

export const getMyRequests = authorize(
	[UserRole.Requester],
	async (input: z.infer<typeof paginationSchema>, _event, user) =>
		loggedQuery("myRequests", user, () => listMyRequests(user.id, input)),
);

// --- GET /vacation-requests?status=&userId=&page=&limit= (Validator) ---

const filterSchema = paginationSchema.extend({
	status: z.enum(VacationRequestStatus).optional(),
	userId: z.uuid().optional(),
});

export const parseFilterInput: InputParserFn = (event) => parseQuery(event, filterSchema);

export const getAllRequests = authorize(
	[UserRole.Validator],
	async ({ status, userId, page, limit }: z.infer<typeof filterSchema>, _event, user) =>
		loggedQuery("allRequests", user, () => listAllRequests({ status, userId }, { page, limit }), { status, userId }),
);

// --- GET /vacation-requests/:id (Validator) ---

export const getRequestById = authorize([UserRole.Validator], async (input: { id: string }, _event, user) =>
	loggedQuery("oneRequest", user, () => getRequest(input.id), { id: input.id }),
);
