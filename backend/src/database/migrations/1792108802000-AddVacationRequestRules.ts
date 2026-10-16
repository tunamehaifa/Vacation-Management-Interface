import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Business rules the database itself guarantees. The application checks the
 * same rules first and returns friendly errors; these constraints are the last
 * line of defence, e.g. against two overlapping requests submitted at the same
 * moment, which an application-level check alone cannot stop.
 *
 * Rules that depend on "today" or on who is acting (no past dates, approved
 * requests are immutable, only validators decide) stay in the application.
 */
export class AddVacationRequestRules1792108802000 implements MigrationInterface {
	name = "AddVacationRequestRules1792108802000";

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Rule 1: the end date must be strictly after the start date.
		await queryRunner.query(`
			ALTER TABLE vacation_requests
				ADD CONSTRAINT chk_vacation_requests_end_after_start
				CHECK (end_date > start_date)
		`);

		// Rule 5: a rejected request must carry a non-blank comment.
		// "IS NOT NULL" is needed: length(btrim(NULL)) is NULL, and a CHECK
		// that evaluates to NULL counts as passed.
		await queryRunner.query(`
			ALTER TABLE vacation_requests
				ADD CONSTRAINT chk_vacation_requests_rejection_has_comment
				CHECK (status <> 'Rejected' OR (comments IS NOT NULL AND length(btrim(comments)) > 0))
		`);

		// Rule 2: requests of the same user must not overlap.
		// Only Pending and Approved requests count; a rejected one frees its days.
		// btree_gist lets a GiST index compare plain uuids with "=" next to the
		// date-range "&&" (overlaps) operator.
		await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);
		await queryRunner.query(`
			ALTER TABLE vacation_requests
				ADD CONSTRAINT excl_vacation_requests_no_overlap
				EXCLUDE USING gist (
					user_id                                  WITH =,
					daterange(start_date, end_date, '[]')    WITH &&
				)
				WHERE (status <> 'Rejected')
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			ALTER TABLE vacation_requests DROP CONSTRAINT excl_vacation_requests_no_overlap
		`);
		await queryRunner.query(`
			ALTER TABLE vacation_requests DROP CONSTRAINT chk_vacation_requests_rejection_has_comment
		`);
		await queryRunner.query(`
			ALTER TABLE vacation_requests DROP CONSTRAINT chk_vacation_requests_end_after_start
		`);
		// btree_gist is left installed: other objects may depend on it.
	}
}
