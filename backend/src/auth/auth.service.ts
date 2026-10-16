import bcrypt from "bcryptjs";
import { getDataSource } from "../database/data-source";
import { User } from "../entities/user.entity";
import { NotFoundError, UnauthorizedError } from "../http/errors";
import { logger } from "../logger";
import { signToken } from "./jwt";

/** The user as the API shows it — never with the password hash. */
export interface UserView {
	id: string;
	name: string;
	email: string;
	role: User["role"];
}

const toView = ({ id, name, email, role }: User): UserView => ({ id, name, email, role });

// Compared against when the email is unknown, so a wrong email takes as long
// as a wrong password and response timing does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer", 10);

export const login = async (email: string, password: string) => {
	const users = (await getDataSource()).getRepository(User);
	const user = await users
		.createQueryBuilder("user")
		.addSelect("user.passwordHash")
		.where("user.email = :email", { email: email.toLowerCase() })
		.getOne();

	const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
	if (!user || !passwordOk) {
		// The client gets one message for both cases; the log tells them apart.
		// The email is not logged: people sometimes type their password into it.
		logger.warn({ auth: "login failed", failure: user ? "wrong password" : "unknown email" }, "auth");
		throw new UnauthorizedError("Invalid email or password");
	}

	logger.info({ auth: "login", user: `${user.role}:${user.id}` }, "auth");
	return { token: signToken(user), user: toView(user) };
};

export const getUserById = async (id: string): Promise<UserView> => {
	const user = await (await getDataSource()).getRepository(User).findOneBy({ id });
	// The token is valid but its user is gone (e.g. deleted): treat as signed out.
	if (!user) {
		logger.warn({ auth: "token of a deleted user", user: id }, "auth");
		throw new UnauthorizedError("User no longer exists");
	}
	return toView(user);
};
