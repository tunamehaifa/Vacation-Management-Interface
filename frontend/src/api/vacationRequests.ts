import { http } from './http'

export type VacationRequestStatus = 'Pending' | 'Approved' | 'Rejected'

export interface VacationRequest {
  id: string
  /** Filled in the validator and team views; null in "my requests". */
  user: { id: string; name: string } | null
  /** "YYYY-MM-DD", both days inclusive. */
  startDate: string
  endDate: string
  reason: string | null
  status: VacationRequestStatus
  /** The validator's comment (always set on rejected requests). */
  comments: string | null
  createdAt: string
  updatedAt: string
}

/**
 * A Pending request whose start date has passed can no longer be approved,
 * only rejected (rule 4; the API refuses it too). Today is the user's date here
 * and the server's UTC date in the API, so they can differ near midnight.
 */
export const isOverdue = (request: VacationRequest, today: string) =>
  request.status === 'Pending' && request.startDate < today

/** What the requester fills in, for both creating and editing. */
export interface VacationPeriod {
  startDate: string
  endDate: string
  reason: string | null
}

/** One page of a list: `total` counts the items on all pages. */
export interface Page<T> {
  items: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface PageRequest {
  page: number
  limit: number
}

/** The validator's list filters; leave one out to not filter on it. */
export interface RequestFilters {
  status?: VacationRequestStatus
  userId?: string
}

export const vacationRequestsApi = {
  /** Validator: every request, newest first. */
  list: (filters: RequestFilters, paging: PageRequest) =>
    http
      .get<Page<VacationRequest>>('/vacation-requests', { params: { ...filters, ...paging } })
      .then((res) => res.data),

  /** Validator: one request with its user. */
  get: (id: string) => http.get<VacationRequest>(`/vacation-requests/${id}`).then((res) => res.data),

  approve: (id: string) =>
    http.post<VacationRequest>(`/vacation-requests/${id}/approve`).then((res) => res.data),

  reject: (id: string, comment: string) =>
    http.post<VacationRequest>(`/vacation-requests/${id}/reject`, { comment }).then((res) => res.data),

  mine: (paging: PageRequest) =>
    http
      .get<Page<VacationRequest>>('/vacation-requests/mine', { params: paging })
      .then((res) => res.data),

  create: (period: VacationPeriod) =>
    http.post<VacationRequest>('/vacation-requests', period).then((res) => res.data),

  update: (id: string, period: VacationPeriod) =>
    http.put<VacationRequest>(`/vacation-requests/${id}`, period).then((res) => res.data),

  cancel: (id: string) => http.delete(`/vacation-requests/${id}`).then(() => undefined),
}
