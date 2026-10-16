import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import type { User } from "./user.entity";

export enum VacationRequestStatus {
	Pending = "Pending",
	Approved = "Approved",
	Rejected = "Rejected",
}

/**
 * Vacation dates are calendar days (`date` columns), kept as "YYYY-MM-DD"
 * strings so no timezone conversion can shift them. Both days are inclusive.
 *
 * Table, indexes and the business-rule constraints are created by the
 * migrations in src/database/migrations.
 */
@Entity({ name: "vacation_requests" })
export class VacationRequest {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@Column({ name: "user_id", type: "uuid" })
	userId: string;

	@ManyToOne("User", (user: User) => user.vacationRequests, { onDelete: "CASCADE" })
	@JoinColumn({ name: "user_id" })
	user: User;

	@Column({ name: "start_date", type: "date" })
	startDate: string;

	@Column({ name: "end_date", type: "date" })
	endDate: string;

	@Column({ type: "text", nullable: true })
	reason: string | null;

	@Column({
		type: "enum",
		enum: VacationRequestStatus,
		enumName: "vacation_request_status",
		default: VacationRequestStatus.Pending,
	})
	status: VacationRequestStatus;

	/** Validator's comment; required when the request is rejected. */
	@Column({ type: "text", nullable: true })
	comments: string | null;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt: Date;
}
