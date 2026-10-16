import { In } from "typeorm";
import type { AuthUser } from "../auth/jwt";
import { getDataSource } from "../database/data-source";
import { User, UserRole } from "../entities/user.entity";
import { VacationRequest, VacationRequestStatus } from "../entities/vacation-request.entity";
import { Page, PageRequest, toPage, toSkipTake } from "../http/pagination";
import { toView, VacationRequestView } from "./view";

/**
 * Reads. They change nothing, so they are plain functions rather than
 * commands; who may call them is checked on their routes.
 *
 * Lists are paginated. Their order always ends with the id, so a row can
 * never appear on two pages or on none when timestamps or names are equal.
 */

/** Requester view: the user's own requests, newest first. */
export async function listMyRequests(userId: string, paging: PageRequest): Promise<Page<VacationRequestView>> {
	const [requests, total] = await (await getDataSource()).getRepository(VacationRequest).findAndCount({
		where: { userId },
		order: { createdAt: "DESC", id: "DESC" },
		...toSkipTake(paging),
	});
	return toPage(requests.map(toView), total, paging);
}

export interface RequestFilters {
	status?: VacationRequestStatus;
	userId?: string;
}

/** Validator view: every request, optionally filtered by status and/or user, newest first. */
export async function listAllRequests(
	filters: RequestFilters,
	paging: PageRequest,
): Promise<Page<VacationRequestView>> {
	const [requests, total] = await (await getDataSource()).getRepository(VacationRequest).findAndCount({
		where: {
			...(filters.status && { status: filters.status }),
			...(filters.userId && { userId: filters.userId }),
		},
		relations: { user: true },
		order: { createdAt: "DESC", id: "DESC" },
		...toSkipTake(paging),
	});
	return toPage(requests.map(toView), total, paging);
}

const PLANNED = [VacationRequestStatus.Approved, VacationRequestStatus.Pending];

/**
 * Team planning (both roles): who is away in the [from, to] window. Rejected
 * requests are not plans, so only Approved and Pending ones count.
 *
 * Paginated by person, not by vacation: a page holds `limit` people (by
 * name) together with all their vacations in the window, so a person's row
 * is never split across pages. `total` is the number of people.
 *
 * A reason can be personal, so it is shared only with validators and with
 * the person it belongs to; other requesters see who is away when, not why.
 */
export async function listTeamVacations(
	from: string,
	to: string,
	viewer: AuthUser,
	paging: PageRequest,
): Promise<Page<VacationRequestView>> {
	const dataSource = await getDataSource();

	// 1. The page of people who have a planned vacation in the window.
	const { skip, take } = toSkipTake(paging);
	const [people, total] = await dataSource
		.getRepository(User)
		.createQueryBuilder("user")
		.where((qb) => {
			const planned = qb
				.subQuery()
				.select("1")
				.from(VacationRequest, "request")
				.where("request.userId = user.id")
				.andWhere("request.status IN (:...planned)")
				.andWhere("request.startDate <= :to AND request.endDate >= :from")
				.getQuery();
			return `EXISTS ${planned}`;
		})
		.setParameters({ planned: PLANNED, from, to })
		.orderBy("user.name", "ASC")
		.addOrderBy("user.id", "ASC")
		.skip(skip)
		.take(take)
		.getManyAndCount();

	if (people.length === 0) return toPage([], total, paging);

	// 2. Their vacations in the window.
	const requests = await dataSource
		.getRepository(VacationRequest)
		.createQueryBuilder("request")
		.innerJoinAndSelect("request.user", "user")
		.where({ userId: In(people.map((person) => person.id)) })
		.andWhere("request.status IN (:...planned)", { planned: PLANNED })
		.andWhere("request.startDate <= :to AND request.endDate >= :from", { from, to })
		.orderBy("user.name", "ASC")
		.addOrderBy("request.startDate", "ASC")
		.getMany();

	const seesReason = (request: VacationRequest) =>
		viewer.role === UserRole.Validator || request.userId === viewer.id;
	const items = requests.map((request) => ({
		...toView(request),
		reason: seesReason(request) ? request.reason : null,
	}));
	return toPage(items, total, paging);
}

/** For the validator's "filter by user" list (short: not paginated). */
export async function listUsers(role?: UserRole) {
	const users = await (await getDataSource()).getRepository(User).find({
		where: role ? { role } : {},
		order: { name: "ASC" },
	});
	return users.map(({ id, name, email, role }) => ({ id, name, email, role }));
}
