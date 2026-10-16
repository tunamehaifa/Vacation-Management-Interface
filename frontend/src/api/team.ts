import { http } from './http'
import type { Page, PageRequest, VacationRequest } from './vacationRequests'

/**
 * Approved and Pending vacations touching [from, to], with the user's name.
 * Paged by person: a page holds `limit` people and all their vacations;
 * `total` is the number of people.
 */
export interface TeamVacations extends Page<VacationRequest> {
  from: string
  to: string
}

export const teamApi = {
  vacations: (from: string, to: string, paging: PageRequest) =>
    http
      .get<TeamVacations>('/team/vacations', { params: { from, to, ...paging } })
      .then((res) => res.data),
}
