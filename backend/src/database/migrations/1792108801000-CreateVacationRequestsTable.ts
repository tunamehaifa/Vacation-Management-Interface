import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Vacation requests, one row per request. A request starts as Pending and is
 * decided once by a Validator (Approved or Rejected).
 *
 * Business-rule constraints are added separately in AddVacationRequestRules,
 * so this migration only describes the shape of the data.
 */
export class CreateVacationRequestsTable1792108801000 implements MigrationInterface {
	name = "CreateVacationRequestsTable1792108801000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TYPE vacation_request_status AS ENUM ('Pending', 'Approved', 'Rejected')
		`);

		await queryRunner.query(`
			CREATE TABLE vacation_requests (
				id          uuid                     NOT NULL DEFAULT gen_random_uuid(),
				user_id     uuid                     NOT NULL,
				start_date  date                     NOT NULL,  -- first day off (inclusive)
				end_date    date                     NOT NULL,  -- last day off (inclusive)
				reason      text,                               -- optional, written by the requester
				status      vacation_request_status  NOT NULL DEFAULT 'Pending',
				comments    text,                               -- written by the validator
				created_at  timestamptz              NOT NULL DEFAULT now(),
				updated_at  timestamptz              NOT NULL DEFAULT now(),

				CONSTRAINT pk_vacation_requests PRIMARY KEY (id),

				-- Deleting a user removes their requests too.
				CONSTRAINT fk_vacation_requests_user
					FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE vacation_requests`);
		await queryRunner.query(`DROP TYPE vacation_request_status`);
	}
}
