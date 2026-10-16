import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import type { VacationRequest } from "./vacation-request.entity";

export enum UserRole {
	Requester = "Requester",
	Validator = "Validator",
}

/** Table and constraints are created by the migrations in src/database/migrations. */
@Entity({ name: "users" })
export class User {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@Column({ type: "varchar", length: 100 })
	name: string;

	@Column({ type: "varchar", length: 255, unique: true })
	email: string;

	/** bcrypt hash (the column keeps the spec's name). Not selected unless asked for. */
	@Column({ name: "password", type: "varchar", length: 255, select: false })
	passwordHash: string;

	@Column({ type: "enum", enum: UserRole, enumName: "user_role" })
	role: UserRole;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt: Date;

	@OneToMany("VacationRequest", (request: VacationRequest) => request.user)
	vacationRequests: VacationRequest[];
}
