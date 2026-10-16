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

export const vacationRequestsApi = {
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
