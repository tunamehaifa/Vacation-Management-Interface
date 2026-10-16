import { http } from './http'
import type { VacationRequest } from './vacationRequests'

export interface TeamVacations {
  from: string
  to: string
  /** Approved and Pending vacations touching [from, to], with the user's name. */
  items: VacationRequest[]
}

export const teamApi = {
  vacations: (from: string, to: string) =>
    http.get<TeamVacations>('/team/vacations', { params: { from, to } }).then((res) => res.data),
}
