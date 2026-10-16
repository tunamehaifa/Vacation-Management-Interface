import type { AuthUser } from "../auth/jwt";
import type { UserRole } from "../entities/user.entity";

/**
 * A command is an intent to change state (CreateVacationRequestCommand,
 * ApproveVacationRequestCommand, ...). It is plain data; its single handler
 * does the work.
 *
 * Every command class declares who may run it:
 *   static readonly access = [UserRole.Validator]
 * The authorization middleware enforces it, and refuses commands without it.
 */
export abstract class Command<TResult = void> {
	/**
	 * Not a real field: `declare` creates nothing at runtime. It only tells
	 * TypeScript what the command returns, so that
	 *   commandBus.execute(new ApproveVacationRequestCommand(id), ctx)
	 * is typed as Promise<VacationRequestView> with no cast, and a handler that
	 * returns something else fails to compile. (TypeScript compares types by
	 * shape; without this line, Command<A> and Command<B> would look the same.)
	 */
	declare readonly __result?: TResult;
}

/** Roles allowed to run a command, or "public" for anyone (even without a token). */
export type Access = readonly UserRole[] | "public";

export interface CommandClass<C extends Command<any> = Command<any>> {
	new (...args: any[]): C;
	readonly name: string;
	readonly access: Access;
}

export type ResultOf<C> = C extends Command<infer R> ? R : never;

/** Who runs the command. Passed next to it, so commands stay plain data. */
export interface ExecutionContext {
	actor: AuthUser | null;
}

export interface CommandHandler<C extends Command<any>> {
	handle(command: C, context: ExecutionContext): Promise<ResultOf<C>>;
}

/**
 * Runs around every command handler. Call `next()` to continue down the
 * pipeline; throw to stop it. Middlewares run in the order they were added.
 */
export type CommandMiddleware = (
	command: Command<any>,
	context: ExecutionContext,
	next: () => Promise<unknown>,
) => Promise<unknown>;

/**
 * The actor of a non-public command. The authorization middleware has already
 * rejected anonymous callers, so this only narrows the type for the handler.
 */
export function actorOf(context: ExecutionContext): AuthUser {
	if (!context.actor) throw new Error("Command reached its handler without an actor");
	return context.actor;
}
