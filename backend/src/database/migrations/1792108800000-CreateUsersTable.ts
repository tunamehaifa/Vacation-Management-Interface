import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Users who can sign in. The role decides which interface they get:
 * Requesters submit vacation requests, Validators review them.
 */
export class CreateUsersTable1792108800000 implements MigrationInterface {
	name = "CreateUsersTable1792108800000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TYPE user_role AS ENUM ('Requester', 'Validator')
		`);

		await queryRunner.query(`
			CREATE TABLE users (
				id          uuid          NOT NULL DEFAULT gen_random_uuid(),
				name        varchar(100)  NOT NULL,
				email       varchar(255)  NOT NULL,
				password    varchar(255)  NOT NULL,  -- bcrypt hash, never the plain password
				role        user_role     NOT NULL,
				created_at  timestamptz   NOT NULL DEFAULT now(),

				CONSTRAINT pk_users       PRIMARY KEY (id),
				CONSTRAINT uq_users_email UNIQUE (email)  -- also the index used by login
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE users`);
		await queryRunner.query(`DROP TYPE user_role`);
	}
}
