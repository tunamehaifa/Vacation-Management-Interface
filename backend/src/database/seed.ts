import bcrypt from "bcryptjs";
import { AppDataSource } from "./data-source";
import { User, UserRole } from "../entities/user.entity";
import { VacationRequest, VacationRequestStatus } from "../entities/vacation-request.entity";

/**
 * Demo data for local development. Safe to re-run: users are upserted by
 * email, sample requests are only added while the table is empty.
 */
const DEMO_PASSWORD = "Password123!";

const demoUsers = [
	{ name: "Victoria Lambert", email: "validator@example.com", role: UserRole.Validator },
	{ name: "Alice Martin", email: "alice@example.com", role: UserRole.Requester },
	{ name: "Bob Dupont", email: "bob@example.com", role: UserRole.Requester },
	{ name: "Chloe Bernard", email: "chloe@example.com", role: UserRole.Requester },
];

/** "YYYY-MM-DD" for today + `days`, so sample requests never fall in the past. */
const daysFromToday = (days: number): string => {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
};

const sampleRequests = (usersByEmail: Map<string, User>): Partial<VacationRequest>[] => {
	const alice = usersByEmail.get("alice@example.com")!;
	const bob = usersByEmail.get("bob@example.com")!;
	const chloe = usersByEmail.get("chloe@example.com")!;
	return [
		{ userId: alice.id, startDate: daysFromToday(14), endDate: daysFromToday(18), reason: "Family trip", status: VacationRequestStatus.Approved },
		{ userId: alice.id, startDate: daysFromToday(45), endDate: daysFromToday(49), reason: "Wedding", status: VacationRequestStatus.Pending },
		{ userId: bob.id, startDate: daysFromToday(16), endDate: daysFromToday(23), reason: "Hiking", status: VacationRequestStatus.Approved },
		{ userId: bob.id, startDate: daysFromToday(30), endDate: daysFromToday(32), reason: null, status: VacationRequestStatus.Rejected, comments: "Release week, please pick other dates." },
		{ userId: bob.id, startDate: daysFromToday(60), endDate: daysFromToday(64), reason: null, status: VacationRequestStatus.Pending },
		{ userId: chloe.id, startDate: daysFromToday(7), endDate: daysFromToday(9), reason: "Moving house", status: VacationRequestStatus.Pending },
	];
};

async function seed(): Promise<void> {
	await AppDataSource.initialize();
	const users = AppDataSource.getRepository(User);
	const requests = AppDataSource.getRepository(VacationRequest);

	const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
	await users.upsert(
		demoUsers.map((user) => ({ ...user, passwordHash })),
		{ conflictPaths: ["email"] },
	);
	console.log(`Users: ${demoUsers.length} demo accounts, password "${DEMO_PASSWORD}"`);

	if ((await requests.count()) === 0) {
		const usersByEmail = new Map((await users.find()).map((user) => [user.email, user]));
		const rows = sampleRequests(usersByEmail);
		await requests.insert(rows);
		console.log(`Vacation requests: ${rows.length} samples added`);
	} else {
		console.log("Vacation requests: table not empty, samples skipped");
	}

	await AppDataSource.destroy();
}

seed().catch((err) => {
	console.error("Seeding failed:", err);
	process.exit(1);
});
