import { getDataSource } from "../../database/data-source";
import { translateConstraintErrors } from "../../database/constraint-errors";
import { Access, actorOf, Command, CommandHandler, ExecutionContext } from "../../cqrs/command";
import { EventBus } from "../../cqrs/event-bus";
import { UserRole } from "../../entities/user.entity";
import { VacationRequestUpdatedEvent } from "../events";
import { findOverlapping, loadOwnForUpdate } from "../repository";
import { assertNoOverlap, assertPending, assertValidPeriod, todayUtc } from "../rules";
import { toView, VacationRequestView } from "../view";

/** A requester changes the dates or reason of their own Pending request (rule 3). */
export class UpdateVacationRequestCommand extends Command<VacationRequestView> {
	static readonly access: Access = [UserRole.Requester];

	constructor(
		readonly requestId: string,
		readonly startDate: string,
		readonly endDate: string,
		readonly reason: string | null,
	) {
		super();
	}
}

export class UpdateVacationRequestHandler implements CommandHandler<UpdateVacationRequestCommand> {
	constructor(private readonly events: EventBus) {}

	async handle(command: UpdateVacationRequestCommand, context: ExecutionContext): Promise<VacationRequestView> {
		const actor = actorOf(context);
		assertValidPeriod(command.startDate, command.endDate, todayUtc());

		const dataSource = await getDataSource();
		const view = await translateConstraintErrors(() =>
			dataSource.transaction(async (manager) => {
				const request = await loadOwnForUpdate(manager, command.requestId, actor.id);
				assertPending(request, "modify");
				assertNoOverlap(
					await findOverlapping(manager, actor.id, command.startDate, command.endDate, request.id),
				);

				request.startDate = command.startDate;
				request.endDate = command.endDate;
				request.reason = command.reason;
				return toView(await manager.save(request));
			}),
		);

		await this.events.publish(new VacationRequestUpdatedEvent(view, actor.id));
		return view;
	}
}
