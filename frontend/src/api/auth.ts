import { http } from './http'

export type UserRole = 'Requester' | 'Validator'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface LoginResponse {
  token: string
  user: User
}

export const authApi = {
  login: (email: string, password: string) =>
    http.post<LoginResponse>('/auth/login', { email, password }).then((res) => res.data),

  me: () => http.get<User>('/auth/me').then((res) => res.data),
}
