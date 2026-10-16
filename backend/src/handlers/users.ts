import { z } from "zod";
import { authorize } from "../auth/authorize";
import { UserRole } from "../entities/user.entity";
import { parseQuery } from "../http/request";
import { listUsers } from "../vacation-requests/queries";
import { InputParserFn } from "./types";

// --- GET /users?role= (Validator: fills the dashboard's "filter by user" list) ---

const usersSchema = z.object({ role: z.enum(UserRole).optional() });

export const parseUsersInput: InputParserFn = (event) => parseQuery(event, usersSchema);

export const getUsers = authorize([UserRole.Validator], async (input: z.infer<typeof usersSchema>) => ({
	items: await listUsers(input.role),
}));
