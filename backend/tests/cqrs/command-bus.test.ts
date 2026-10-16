import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "../../src/entities/user.entity";
import { ForbiddenError, UnauthorizedError } from "../../src/http/errors";
import { Access, Command, CommandClass, CommandHandler, ExecutionContext } from "../../src/cqrs/command";
import { CommandBus } from "../../src/cqrs/command-bus";
import { authorizationMiddleware } from "../../src/cqrs/middleware/authorization";
import { commandLoggingMiddleware } from "../../src/cqrs/middleware/command-logging";
import { logger } from "../../src/logger";

class ValidatorOnlyCommand extends Command<string> {
	static readonly access: Access = [UserRole.Validator];
	constructor(readonly value: string) {
		super();
	}
}

class PublicCommand extends Command<string> {
	static readonly access: Access = "public";
}

class UndeclaredCommand extends Command<string> {}

const validator: ExecutionContext = { actor: { id: "v-1", role: UserRole.Validator } };
const requester: ExecutionContext = { actor: { id: "r-1", role: UserRole.Requester } };
const anonymous: ExecutionContext = { actor: null };

const echo: CommandHandler<ValidatorOnlyCommand> = { handle: async (command) => command.value };
const ok: CommandHandler<Command<string>> = { handle: async () => "ok" };

describe("CommandBus", () => {
	it("sends a command to its handler and returns the result", async () => {
		const bus = new CommandBus().register(ValidatorOnlyCommand, echo);
		await expect(bus.execute(new ValidatorOnlyCommand("hi"), validator)).resolves.toBe("hi");
	});

	it("runs middlewares in the order they were added, around the handler", async () => {
		const calls: string[] = [];
		const bus = new CommandBus()
			.use(async (_c, _ctx, next) => (calls.push("first:in"), await next().finally(() => calls.push("first:out"))))
			.use(async (_c, _ctx, next) => (calls.push("second:in"), await next().finally(() => calls.push("second:out"))))
			.register(ValidatorOnlyCommand, { handle: async () => (calls.push("handler"), "done") });

		await bus.execute(new ValidatorOnlyCommand("x"), validator);
		expect(calls).toEqual(["first:in", "second:in", "handler", "second:out", "first:out"]);
	});

	it("refuses a second handler for the same command", () => {
		const bus = new CommandBus().register(ValidatorOnlyCommand, echo);
		expect(() => bus.register(ValidatorOnlyCommand, echo)).toThrow(/already registered/);
	});

	it("fails for a command without a handler", async () => {
		await expect(new CommandBus().execute(new ValidatorOnlyCommand("x"), validator)).rejects.toThrow(
			/No handler registered for ValidatorOnlyCommand/,
		);
	});
});

describe("authorization middleware", () => {
	let bus: CommandBus;
	const handler = vi.fn(async () => "ran");

	beforeEach(() => {
		handler.mockClear();
		bus = new CommandBus()
			.use(authorizationMiddleware)
			.register(ValidatorOnlyCommand, { handle: handler })
			.register(PublicCommand, ok)
			// TypeScript already refuses this registration; the cast simulates the mistake
			// to prove the runtime check fails closed as well.
			.register(UndeclaredCommand as unknown as CommandClass<UndeclaredCommand>, ok);
	});

	it("runs the command for an allowed role", async () => {
		await expect(bus.execute(new ValidatorOnlyCommand("x"), validator)).resolves.toBe("ran");
	});

	it("rejects a signed-in user with another role (403) without running the handler", async () => {
		await expect(bus.execute(new ValidatorOnlyCommand("x"), requester)).rejects.toBeInstanceOf(ForbiddenError);
		expect(handler).not.toHaveBeenCalled();
	});

	it("rejects an anonymous caller (401) without running the handler", async () => {
		await expect(bus.execute(new ValidatorOnlyCommand("x"), anonymous)).rejects.toBeInstanceOf(UnauthorizedError);
		expect(handler).not.toHaveBeenCalled();
	});

	it("lets anyone run a public command", async () => {
		await expect(bus.execute(new PublicCommand(), anonymous)).resolves.toBe("ok");
	});

	it("fails closed when a command does not declare its access", async () => {
		await expect(bus.execute(new UndeclaredCommand(), validator)).rejects.toThrow(
			/UndeclaredCommand does not declare who may run it/,
		);
	});
});

describe("logging middleware", () => {
	it("logs the command, the actor and the outcome — including refusals", async () => {
		const info = vi.spyOn(logger, "info").mockImplementation(() => {});
		const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
		const bus = new CommandBus()
			.use(commandLoggingMiddleware)
			.use(authorizationMiddleware)
			.register(ValidatorOnlyCommand, echo);

		await bus.execute(new ValidatorOnlyCommand("x"), validator);
		await bus.execute(new ValidatorOnlyCommand("x"), requester).catch(() => {});

		expect(info).toHaveBeenCalledWith(
			{ command: "ValidatorOnlyCommand", actor: "Validator:v-1", outcome: "ok", ms: expect.any(Number) },
			"command",
		);
		expect(warn).toHaveBeenCalledWith(
			{ command: "ValidatorOnlyCommand", actor: "Requester:r-1", outcome: "FORBIDDEN", ms: expect.any(Number) },
			"command refused",
		);
		info.mockRestore();
		warn.mockRestore();
	});
});
