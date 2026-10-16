import { EntityManager, In, LessThanOrEqual, MoreThanOrEqual, Not } from "typeorm";
import { User } from "../entities/user.entity";
import { VacationRequest, VacationRequestStatus } from "../entities/vacation-request.entity";
import { NotFoundError } from "../http/errors";

/** Data access shared by the command handlers. Always runs inside their transaction. */

/** The user's Pending/Approved requests that share at least one day with the period. */
export const findOverlapping = (
	manager: EntityManager,
	userId: string,
	startDate: string,
	endDate: string,
	excludeId?: string,
): Promise<VacationRequest[]> =>
	manager.find(VacationRequest, {
		where: {
			userId,
			status: In([VacationRequestStatus.Pending, VacationRequestStatus.Approved]),
			// Both ends inclusive: [start, end] overlaps [s, e] when start <= e and end >= s.
			startDate: LessThanOrEqual(endDate),
			endDate: MoreThanOrEqual(startDate),
			...(excludeId && { id: Not(excludeId) }),
		},
		order: { startDate: "ASC" },
	});

/**
 * Loads a request and locks its row until the transaction ends, so two
 * people acting on it at once (e.g. approve and cancel) happen one after the
 * other rather than both succeeding.
 */
export async function loadForUpdate(manager: EntityManager, id: string): Promise<VacationRequest> {
	const request = await manager.findOne(VacationRequest, {
		where: { id },
		lock: { mode: "pessimistic_write" },
	});
	if (!request) throw new NotFoundError("Vacation request not found");
	return request;
}

/**
 * Like loadForUpdate, for a requester acting on their own request. Someone
 * else's request is reported as not found, so ids of other people's requests
 * cannot be probed.
 */
export async function loadOwnForUpdate(manager: EntityManager, id: string, userId: string): Promise<VacationRequest> {
	const request = await loadForUpdate(manager, id);
	if (request.userId !== userId) throw new NotFoundError("Vacation request not found");
	return request;
}

/**
 * Adds the owner to a request, so a validator's response says whose request
 * it is, like the list does. Loaded separately: the row lock above cannot
 * cover an outer join to users.
 */
export async function withOwner(manager: EntityManager, request: VacationRequest): Promise<VacationRequest> {
	request.user = await manager.findOneByOrFail(User, { id: request.userId });
	return request;
}
