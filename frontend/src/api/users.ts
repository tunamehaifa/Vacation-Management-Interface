import type { UserRole } from './auth'
import { http } from './http'

export interface UserSummary {
  id: string
  name: string
  email: string
  role: UserRole
}

export const usersApi = {
  /** Validator: everyone (or one role), by name. Fills the dashboard's employee filter. */
  list: (role?: UserRole) =>
    http.get<{ items: UserSummary[] }>('/users', { params: { role } }).then((res) => res.data.items),
}
