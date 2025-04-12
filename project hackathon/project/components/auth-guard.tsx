"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import type { User } from "@/lib/auth"
import { Loader2 } from "lucide-react"

interface AuthGuardProps {
  children: React.ReactNode
  allowedRoles?: ("school" | "student")[]
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/me")
        if (response.ok) {
          const userData = await response.json()
          setUser(userData)

          // Check if user has the required role
          if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
            // Redirect based on role
            if (userData.role === "school") {
              router.push("/admin-dashboard")
            } else {
              router.push("/student-dashboard")
            }
          }
        } else {
          setUser(null)
          if (pathname !== "/login" && pathname !== "/") {
            router.push("/login")
          }
        }
      } catch (error) {
        setUser(null)
        if (pathname !== "/login" && pathname !== "/") {
          router.push("/login")
        }
      }
    }

    checkAuth()
  }, [router, pathname, allowedRoles])

  // Loading state
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-vidyai-purple" />
      </div>
    )
  }

  // Not authenticated
  if (user === null && pathname !== "/login" && pathname !== "/") {
    router.push("/login")
    return null
  }

  // Authenticated but wrong role
  if (user && allowedRoles && !allowedRoles.includes(user.role)) {
    // This will be handled in the useEffect
    return null
  }

  // Authenticated and correct role (or no role restriction)
  return <>{children}</>
}
