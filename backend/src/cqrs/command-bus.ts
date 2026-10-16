import {
	Command,
	CommandClass,
	CommandHandler,
	CommandMiddleware,
	ExecutionContext,
	ResultOf,
} from "./command";

/**
 * Sends each command to its single handler through a middleware pipeline:
 *
 *   execute(command) → logging → authorization → handler
 */
export class CommandBus {
	private readonly handlers = new Map<Function, CommandHandler<any>>();
	private readonly middlewares: CommandMiddleware[] = [];

	use(middleware: CommandMiddleware): this {
		this.middlewares.push(middleware);
		return this;
	}

	register<C extends Command<any>>(type: CommandClass<C>, handler: CommandHandler<C>): this {
		if (this.handlers.has(type)) {
			throw new Error(`A handler is already registered for ${type.name}`);
		}
		this.handlers.set(type, handler);
		return this;
	}

	async execute<C extends Command<any>>(command: C, context: ExecutionContext): Promise<ResultOf<C>> {
		const handler = this.handlers.get(command.constructor);
		if (!handler) {
			throw new Error(`No handler registered for ${command.constructor.name}`);
		}

		const runHandler = () => handler.handle(command, context);
		const pipeline = this.middlewares.reduceRight<() => Promise<unknown>>(
			(next, middleware) => () => middleware(command, context, next),
			runHandler,
		);
		return (await pipeline()) as ResultOf<C>;
	}
}
