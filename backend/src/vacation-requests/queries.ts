import type { AuthUser } from "../auth/jwt";
import { getDataSource } from "../database/data-source";
import { User, UserRole } from "../entities/user.entity";
import { VacationRequest, VacationRequestStatus } from "../entities/vacation-request.entity";
import { toView, VacationRequestView } from "./view";

/**
 * Reads. They change nothing, so they are plain functions rather than
 * commands; who may call them is checked on their routes.
 */

/** Requester view: the user's own requests, newest first. */
export async function listMyRequests(userId: string): Promise<VacationRequestView[]> {
	const requests = await (await getDataSource()).getRepository(VacationRequest).find({
		where: { userId },
		order: { createdAt: "DESC" },
	});
	return requests.map(toView);
}

export interface RequestFilters {
	status?: VacationRequestStatus;
	userId?: string;
}

/** Validator view: every request, optionally filtered by status and/or user, newest first. */
export async function listAllRequests(filters: RequestFilters): Promise<VacationRequestView[]> {
	const requests = await (await getDataSource()).getRepository(VacationRequest).find({
		where: {
			...(filters.status && { status: filters.status }),
			...(filters.userId && { userId: filters.userId }),
		},
		relations: { user: true },
		order: { createdAt: "DESC" },
	});
	return requests.map(toView);
}

/**
 * Team planning (both roles): everyone's Approved and Pending vacations that
 * touch the [from, to] window, in date order. Rejected ones are not plans.
 *
 * A reason can be personal, so it is shared only with validators and with
 * the person it belongs to; other requesters see who is away when, not why.
 */
export async function listTeamVacations(from: string, to: string, viewer: AuthUser): Promise<VacationRequestView[]> {
	const requests = await (await getDataSource())
		.getRepository(VacationRequest)
		.createQueryBuilder("request")
		.innerJoinAndSelect("request.user", "user")
		.where("request.status IN (:...statuses)", {
			statuses: [VacationRequestStatus.Approved, VacationRequestStatus.Pending],
		})
		.andWhere("request.startDate <= :to AND request.endDate >= :from", { from, to })
		.orderBy("request.startDate", "ASC")
		.addOrderBy("user.name", "ASC")
		.getMany();

	const seesReasons = (request: VacationRequest) =>
		viewer.role === UserRole.Validator || request.userId === viewer.id;
	return requests.map((request) => ({ ...toView(request), reason: seesReasons(request) ? request.reason : null }));
}

/** For the validator's "filter by user" list. */
export async function listUsers(role?: UserRole) {
	const users = await (await getDataSource()).getRepository(User).find({
		where: role ? { role } : {},
		order: { name: "ASC" },
	});
	return users.map(({ id, name, email, role }) => ({ id, name, email, role }));
}
