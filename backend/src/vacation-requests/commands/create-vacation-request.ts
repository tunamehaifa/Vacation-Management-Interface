import { getDataSource } from "../../database/data-source";
import { translateConstraintErrors } from "../../database/constraint-errors";
import { Access, actorOf, Command, CommandHandler, ExecutionContext } from "../../cqrs/command";
import { EventBus } from "../../cqrs/event-bus";
import { UserRole } from "../../entities/user.entity";
import { VacationRequest } from "../../entities/vacation-request.entity";
import { VacationRequestCreatedEvent } from "../events";
import { findOverlapping } from "../repository";
import { assertNoOverlap, assertValidPeriod, todayUtc } from "../rules";
import { toView, VacationRequestView } from "../view";

/** A requester asks for days off. The new request starts as Pending. */
export class CreateVacationRequestCommand extends Command<VacationRequestView> {
	static readonly access: Access = [UserRole.Requester];

	constructor(
		readonly startDate: string,
		readonly endDate: string,
		readonly reason: string | null,
	) {
		super();
	}
}

export class CreateVacationRequestHandler implements CommandHandler<CreateVacationRequestCommand> {
	constructor(private readonly events: EventBus) {}

	async handle(command: CreateVacationRequestCommand, context: ExecutionContext): Promise<VacationRequestView> {
		const actor = actorOf(context);
		assertValidPeriod(command.startDate, command.endDate, todayUtc());

		const dataSource = await getDataSource();
		const view = await translateConstraintErrors(() =>
			dataSource.transaction(async (manager) => {
				assertNoOverlap(await findOverlapping(manager, actor.id, command.startDate, command.endDate));

				const request = manager.create(VacationRequest, {
					userId: actor.id,
					startDate: command.startDate,
					endDate: command.endDate,
					reason: command.reason,
				});
				return toView(await manager.save(request));
			}),
		);

		await this.events.publish(new VacationRequestCreatedEvent(view, actor.id));
		return view;
	}
}
