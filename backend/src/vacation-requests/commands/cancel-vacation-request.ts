import { getDataSource } from "../../database/data-source";
import { Access, actorOf, Command, CommandHandler, ExecutionContext } from "../../cqrs/command";
import { EventBus } from "../../cqrs/event-bus";
import { UserRole } from "../../entities/user.entity";
import { VacationRequestCancelledEvent } from "../events";
import { loadOwnForUpdate } from "../repository";
import { assertPending } from "../rules";
import { toView } from "../view";

/**
 * A requester withdraws their own Pending request (rule 3). The row is
 * deleted: the assignment's statuses are only Pending/Approved/Rejected.
 */
export class CancelVacationRequestCommand extends Command<void> {
	static readonly access: Access = [UserRole.Requester];

	constructor(readonly requestId: string) {
		super();
	}
}

export class CancelVacationRequestHandler implements CommandHandler<CancelVacationRequestCommand> {
	constructor(private readonly events: EventBus) {}

	async handle(command: CancelVacationRequestCommand, context: ExecutionContext): Promise<void> {
		const actor = actorOf(context);

		const dataSource = await getDataSource();
		const view = await dataSource.transaction(async (manager) => {
			const request = await loadOwnForUpdate(manager, command.requestId, actor.id);
			assertPending(request, "cancel");

			const snapshot = toView(request);
			await manager.remove(request);
			return snapshot;
		});

		await this.events.publish(new VacationRequestCancelledEvent(view, actor.id));
	}
}
