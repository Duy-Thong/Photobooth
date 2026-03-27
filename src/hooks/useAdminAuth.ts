import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { fetchAdminUser, createOrUpdateAdmin, DEFAULT_PERMISSIONS, SUPER_ADMIN_PERMISSIONS } from '@/lib/adminService'
import type { AdminPermissions } from '@/types/admin'

export function useAdminAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined) // undefined = loading
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null)
  const [isAdminLoading, setIsAdminLoading] = useState(true)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        setIsAdminLoading(true)
        try {
          let admin = await fetchAdminUser(u.uid)
          // If this is the main admin (from env) and no record exists, create it
          const superAdminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'duythong.ptit@gmail.com'
          if (!admin && u.email === superAdminEmail) {
            const newAdmin = {
              email: u.email!,
              permissions: SUPER_ADMIN_PERMISSIONS,
              createdAt: new Date().toISOString()
            }
            await createOrUpdateAdmin(u.uid, newAdmin)
            admin = { uid: u.uid, ...newAdmin }
          }
          setPermissions(admin?.permissions ?? DEFAULT_PERMISSIONS)
        } catch (err) {
          console.error('Error fetching admin permissions:', err)
          setPermissions(null)
        } finally {
          setIsAdminLoading(false)
        }
      } else {
        setPermissions(null)
        setIsAdminLoading(false)
      }
    })
    return unsub
  }, [])

  const login = async (email: string, password: string) => {
    setLoggingIn(true)
    setLoginError(null)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setLoginError('Email hoặc mật khẩu không đúng')
      } else {
        setLoginError('Đăng nhập thất bại, thử lại')
      }
    } finally {
      setLoggingIn(false)
    }
  }

  const logout = () => signOut(auth)

  return { user, permissions, isAdminLoading, login, logout, loginError, loggingIn }
}
