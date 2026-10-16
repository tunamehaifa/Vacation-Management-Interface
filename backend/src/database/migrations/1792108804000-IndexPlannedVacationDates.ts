import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Team planning shows Approved and Pending vacations, but the date index
 * covered Approved ones only, so the planner could not use it for Pending.
 * Replace it with one that covers both.
 */
export class IndexPlannedVacationDates1792108804000 implements MigrationInterface {
	name = "IndexPlannedVacationDates1792108804000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX idx_vacation_requests_approved_dates`);
		await queryRunner.query(`
			CREATE INDEX idx_vacation_requests_planned_dates
				ON vacation_requests (start_date, end_date)
				WHERE status IN ('Approved', 'Pending')
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX idx_vacation_requests_planned_dates`);
		await queryRunner.query(`
			CREATE INDEX idx_vacation_requests_approved_dates
				ON vacation_requests (start_date, end_date)
				WHERE status = 'Approved'
		`);
	}
}
