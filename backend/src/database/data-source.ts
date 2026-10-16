import "reflect-metadata";
import { config as loadDotenv } from "dotenv";
import { DataSource } from "typeorm";
import { User } from "../entities/user.entity";
import { VacationRequest } from "../entities/vacation-request.entity";
import { logger } from "../logger";
import { CreateUsersTable1792108800000 } from "./migrations/1792108800000-CreateUsersTable";
import { CreateVacationRequestsTable1792108801000 } from "./migrations/1792108801000-CreateVacationRequestsTable";
import { AddVacationRequestRules1792108802000 } from "./migrations/1792108802000-AddVacationRequestRules";
import { AddVacationRequestIndexes1792108803000 } from "./migrations/1792108803000-AddVacationRequestIndexes";

// The API gets .env from the framework's loadEnv(); the TypeORM CLI and the
// seed script import this file directly, so load it here as well.
loadDotenv({ path: ".env" });

const requiredEnv = (key: string): string => {
	const value = process.env[key];
	if (!value) throw new Error(`Missing environment variable ${key} (see .env.example)`);
	return value;
};

/**
 * Entities and migrations are imported explicitly instead of glob paths, so
 * the same DataSource works under ts-node and inside the single-file bundle
 * that `cef-build` produces. The schema is owned by migrations only.
 */
export const AppDataSource = new DataSource({
	type: "postgres",
	host: requiredEnv("DB_HOST"),
	port: Number(requiredEnv("DB_PORT")),
	username: requiredEnv("DB_USER"),
	password: requiredEnv("DB_PASSWORD"),
	database: requiredEnv("DB_NAME"),
	entities: [User, VacationRequest],
	migrations: [
		CreateUsersTable1792108800000,
		CreateVacationRequestsTable1792108801000,
		AddVacationRequestRules1792108802000,
		AddVacationRequestIndexes1792108803000,
	],
	synchronize: false,
	logging: ["error"],
});

let initializing: Promise<DataSource> | undefined;

/**
 * Opens the connection on first use and reuses it afterwards — the right
 * lifetime both for the local dev server and for a warm Lambda container.
 */
export const getDataSource = (): Promise<DataSource> => {
	if (AppDataSource.isInitialized) return Promise.resolve(AppDataSource);
	const startedAt = performance.now();
	const target = `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
	const ms = () => Math.round(performance.now() - startedAt);
	initializing ??= AppDataSource.initialize().then(
		(dataSource) => {
			logger.info({ db: "connected", target, ms: ms() }, "database");
			return dataSource;
		},
		(err) => {
			// Retried on the next request, e.g. once the database container is up.
			logger.error({ db: "connection failed", target, ms: ms(), err }, "database");
			initializing = undefined;
			throw err;
		},
	);
	return initializing;
};
