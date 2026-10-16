import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Indexes for the queries the API actually runs. Each one names the query it
 * serves; the overlap check itself is already backed by the GiST index that
 * the exclusion constraint created.
 */
export class AddVacationRequestIndexes1792108803000 implements MigrationInterface {
	name = "AddVacationRequestIndexes1792108803000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Requester view: "my requests", newest first, paginated.
		// Also serves the validator's filter by user.
		await queryRunner.query(`
			CREATE INDEX idx_vacation_requests_user_created
				ON vacation_requests (user_id, created_at DESC)
		`);

		// Validator dashboard: filter by status, newest first, paginated.
		await queryRunner.query(`
			CREATE INDEX idx_vacation_requests_status_created
				ON vacation_requests (status, created_at DESC)
		`);

		// Team planning: approved vacations within a date window.
		await queryRunner.query(`
			CREATE INDEX idx_vacation_requests_approved_dates
				ON vacation_requests (start_date, end_date)
				WHERE status = 'Approved'
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX idx_vacation_requests_approved_dates`);
		await queryRunner.query(`DROP INDEX idx_vacation_requests_status_created`);
		await queryRunner.query(`DROP INDEX idx_vacation_requests_user_created`);
	}
}
