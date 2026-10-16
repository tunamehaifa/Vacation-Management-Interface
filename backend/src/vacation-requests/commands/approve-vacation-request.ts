import { getDataSource } from "../../database/data-source";
import { Access, actorOf, Command, CommandHandler, ExecutionContext } from "../../cqrs/command";
import { EventBus } from "../../cqrs/event-bus";
import { UserRole } from "../../entities/user.entity";
import { VacationRequestStatus } from "../../entities/vacation-request.entity";
import { VacationRequestApprovedEvent } from "../events";
import { loadForUpdate, withOwner } from "../repository";
import { assertNotStarted, assertPending, todayUtc } from "../rules";
import { toView, VacationRequestView } from "../view";

/** A validator approves a Pending request that has not started yet (rules 4 and 6). */
export class ApproveVacationRequestCommand extends Command<VacationRequestView> {
	static readonly access: Access = [UserRole.Validator];

	constructor(readonly requestId: string) {
		super();
	}
}

export class ApproveVacationRequestHandler implements CommandHandler<ApproveVacationRequestCommand> {
	constructor(private readonly events: EventBus) {}

	async handle(command: ApproveVacationRequestCommand, context: ExecutionContext): Promise<VacationRequestView> {
		const actor = actorOf(context);

		const dataSource = await getDataSource();
		const view = await dataSource.transaction(async (manager) => {
			const request = await loadForUpdate(manager, command.requestId);
			assertPending(request, "approve");
			assertNotStarted(request, todayUtc());

			request.status = VacationRequestStatus.Approved;
			return toView(await withOwner(manager, await manager.save(request)));
		});

		await this.events.publish(new VacationRequestApprovedEvent(view, actor.id));
		return view;
	}
}
