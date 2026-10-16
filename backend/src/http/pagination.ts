import { z } from "zod";

/**
 * Page-based pagination shared by every list endpoint:
 *   request   ?page=2&limit=10          (page from 1; limit 1–100, default 10)
 *   response  { items, page, limit, total, totalPages }
 */
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 10;

export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type PageRequest = z.infer<typeof paginationSchema>;

export interface Page<T> {
	items: T[];
	page: number;
	limit: number;
	/** Number of matching items on all pages. */
	total: number;
	totalPages: number;
}

/** For TypeORM's `skip` / `take`, or SQL OFFSET / LIMIT. */
export const toSkipTake = ({ page, limit }: PageRequest) => ({ skip: (page - 1) * limit, take: limit });

export const toPage = <T>(items: T[], total: number, { page, limit }: PageRequest): Page<T> => ({
	items,
	page,
	limit,
	total,
	totalPages: Math.ceil(total / limit),
});
