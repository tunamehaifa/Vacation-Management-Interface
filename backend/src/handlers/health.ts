import { HandlerFn } from "./types";

// --- GET /health ---

export const getHealth: HandlerFn = async () => {
	return { status: "ok" };
};
