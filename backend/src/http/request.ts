import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { z } from "zod";
import { ValidationError } from "./errors";

/** Header lookup that ignores case: API Gateway v1 keeps the client's casing. */
export const getHeader = (event: CommonEvent, name: string): string | undefined => {
	const wanted = name.toLowerCase();
	const entry = Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === wanted);
	return entry?.[1];
};

/** Parses the JSON body and validates it against `schema`; throws ValidationError. */
export const parseBody = <T extends z.ZodType>(event: CommonEvent, schema: T): z.infer<T> => {
	let raw: unknown;
	try {
		raw = event.body ? JSON.parse(event.body) : {};
	} catch {
		throw new ValidationError("Request body must be valid JSON");
	}
	return validate(raw, schema);
};

export const validate = <T extends z.ZodType>(value: unknown, schema: T): z.infer<T> => {
	const result = schema.safeParse(value);
	if (!result.success) {
		const details = result.error.issues.map((issue) => ({
			field: issue.path.join("."),
			message: issue.message,
		}));
		throw new ValidationError("Invalid request", details);
	}
	return result.data;
};
