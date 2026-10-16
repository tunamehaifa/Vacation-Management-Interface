import jwt, { SignOptions } from "jsonwebtoken";
import { UserRole } from "../entities/user.entity";

/** What a token says about its owner. Kept minimal: id and role. */
export interface AuthUser {
	id: string;
	role: UserRole;
}

interface TokenPayload {
	sub: string;
	role: UserRole;
}

const secret = (): string => {
	const value = process.env.JWT_SECRET;
	if (!value) throw new Error("Missing environment variable JWT_SECRET (see .env.example)");
	return value;
};

export const signToken = (user: AuthUser): string => {
	const payload: TokenPayload = { sub: user.id, role: user.role };
	const expiresIn = (process.env.JWT_EXPIRES_IN || "8h") as SignOptions["expiresIn"];
	return jwt.sign(payload, secret(), { algorithm: "HS256", expiresIn });
};

/** Returns the token's user, or null if it is malformed, forged or expired. */
export const verifyToken = (token: string): AuthUser | null => {
	try {
		const payload = jwt.verify(token, secret(), { algorithms: ["HS256"] }) as TokenPayload;
		const knownRole = Object.values(UserRole).includes(payload.role);
		if (typeof payload.sub !== "string" || !knownRole) return null;
		return { id: payload.sub, role: payload.role };
	} catch {
		return null;
	}
};
