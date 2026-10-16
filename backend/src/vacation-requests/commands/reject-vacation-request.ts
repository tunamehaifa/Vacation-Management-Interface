import { getDataSource } from "../../database/data-source";
import { translateConstraintErrors } from "../../database/constraint-errors";
import { Access, actorOf, Command, CommandHandler, ExecutionContext } from "../../cqrs/command";
import { EventBus } from "../../cqrs/event-bus";
import { UserRole } from "../../entities/user.entity";
import { VacationRequestStatus } from "../../entities/vacation-request.entity";
import { VacationRequestRejectedEvent } from "../events";
import { loadForUpdate } from "../repository";
import { assertPending, requireRejectionComment } from "../rules";
import { toView, VacationRequestView } from "../view";

/** A validator rejects a Pending request, with a comment (rules 5 and 6). */
export class RejectVacationRequestCommand extends Command<VacationRequestView> {
	static readonly access: Access = [UserRole.Validator];

	constructor(
		readonly requestId: string,
		readonly comment: string,
	) {
		super();
	}
}

export class RejectVacationRequestHandler implements CommandHandler<RejectVacationRequestCommand> {
	constructor(private readonly events: EventBus) {}

	async handle(command: RejectVacationRequestCommand, context: ExecutionContext): Promise<VacationRequestView> {
		const actor = actorOf(context);
		const comment = requireRejectionComment(command.comment);

		const dataSource = await getDataSource();
		const view = await translateConstraintErrors(() =>
			dataSource.transaction(async (manager) => {
				const request = await loadForUpdate(manager, command.requestId);
				assertPending(request, "reject");

				request.status = VacationRequestStatus.Rejected;
				request.comments = comment;
				return toView(await manager.save(request));
			}),
		);

		await this.events.publish(new VacationRequestRejectedEvent(view, actor.id));
		return view;
	}
}
