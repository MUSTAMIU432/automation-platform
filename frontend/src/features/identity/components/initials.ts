import type { AuthUser } from '../auth/authApi'

/** What an avatar needs to know about its person: any account, not only the signed-in one. */
export type AvatarPerson = Pick<AuthUser, 'firstName' | 'lastName' | 'email' | 'avatarUrl'>

/** The initials shown when there is no photo. */
export function initialsFor(user: AvatarPerson | null): string {
  if (!user) return '?'
  const fromName = `${user.firstName.trim().charAt(0)}${user.lastName.trim().charAt(0)}`
  return (fromName || user.email.charAt(0)).toUpperCase()
}
