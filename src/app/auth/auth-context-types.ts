import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string | null
}

export interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signInWithFacebook: () => Promise<{ error: Error | null }>
  signInWithPassword: (emailOrUsername: string, password: string) => Promise<{ error: Error | null }>
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string,
    role?: UserRole,
  ) => Promise<{ error: Error | null; needsEmailConfirmation?: boolean }>
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
