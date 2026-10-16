import { CommonEvent } from "commoneventframework/dist/types/commonEvent";
import { z } from "zod";
import { ANY_ROLE, authorize } from "../auth/authorize";
import * as authService from "../auth/auth.service";
import { parseBody } from "../http/request";
import { loggedQuery } from "./logged-query";
import { HandlerFn, InputParserFn } from "./types";

// --- POST /auth/login ---

const loginSchema = z.object({
	email: z.string().trim().toLowerCase().email(),
	password: z.string().min(1),
});

type LoginInput = z.infer<typeof loginSchema>;

export const parseLoginInput: InputParserFn = (event: CommonEvent) => parseBody(event, loginSchema);

export const login: HandlerFn = async (input: LoginInput) => {
	return authService.login(input.email, input.password);
};

// --- GET /auth/me ---

export const getMe = authorize(ANY_ROLE, async (_input, _event, user) => {
	return loggedQuery("me", user, () => authService.getUserById(user.id));
});
