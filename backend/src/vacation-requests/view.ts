import { VacationRequest, VacationRequestStatus } from "../entities/vacation-request.entity";

/** A vacation request as the API returns it. */
export interface VacationRequestView {
	id: string;
	user: { id: string; name: string } | null;
	startDate: string;
	endDate: string;
	reason: string | null;
	status: VacationRequestStatus;
	comments: string | null;
	createdAt: string;
	updatedAt: string;
}

/** `user` is filled when the relation was loaded (validator and team views). */
export const toView = (request: VacationRequest): VacationRequestView => ({
	id: request.id,
	user: request.user ? { id: request.user.id, name: request.user.name } : null,
	startDate: request.startDate,
	endDate: request.endDate,
	reason: request.reason,
	status: request.status,
	comments: request.comments,
	createdAt: request.createdAt.toISOString(),
	updatedAt: request.updatedAt.toISOString(),
});
