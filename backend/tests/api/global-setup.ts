import { ChildProcess, spawn } from "node:child_process";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { Client } from "pg";
import { PASSWORD, TEST_DB, TEST_PORT, USERS } from "./env";

/**
 * Before the API tests: a fresh database (same PostgreSQL as `docker compose
 * up`, but its own database), the real migrations, three users, and the real
 * dev server on TEST_PORT. After them: the server is stopped and the database dropped.
 */
let server: ChildProcess | undefined;

/** Runs SQL on the server's maintenance database, e.g. to create or drop the test database. */
async function admin(...statements: string[]): Promise<void> {
	const client = new Client({
		host: process.env.DB_HOST,
		port: Number(process.env.DB_PORT),
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		database: "postgres",
	});
	await client.connect();
	try {
		for (const statement of statements) await client.query(statement);
	} finally {
		await client.end();
	}
}

async function recreateDatabase(): Promise<void> {
	config({ path: ".env" });
	await admin(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`, `CREATE DATABASE ${TEST_DB}`);
	process.env.DB_NAME = TEST_DB;
}

async function migrateAndAddUsers(): Promise<void> {
	// Imported only now: the data source reads DB_NAME when it is loaded.
	const { AppDataSource } = await import("../../src/database/data-source");
	const { User } = await import("../../src/entities/user.entity");
	await AppDataSource.initialize();
	await AppDataSource.runMigrations();
	const passwordHash = await bcrypt.hash(PASSWORD, 4);
	await AppDataSource.getRepository(User).insert(Object.values(USERS).map((user) => ({ ...user, passwordHash })) as never);
	await AppDataSource.destroy();
}

async function startServer(): Promise<void> {
	server = spawn(process.execPath, ["node_modules/ts-node/dist/bin.js", "src/index.ts", "--local", String(TEST_PORT)], {
		env: { ...process.env, DB_NAME: TEST_DB, LOG_LEVEL: "silent" },
		stdio: "ignore",
	});
	for (let attempt = 0; attempt < 60; attempt++) {
		try {
			if ((await fetch(`http://localhost:${TEST_PORT}/health`)).ok) return;
		} catch {
			// not listening yet
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error(`The API did not start on port ${TEST_PORT}`);
}

export default async function setup() {
	await recreateDatabase();
	await migrateAndAddUsers();
	await startServer();

	return async () => {
		server?.kill();
		await admin(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
	};
}
