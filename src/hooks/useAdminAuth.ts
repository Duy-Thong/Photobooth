import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export function useAdminAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined) // undefined = loading
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loggingIn, setLoggingIn] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u))
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

  return { user, login, logout, loginError, loggingIn }
}
