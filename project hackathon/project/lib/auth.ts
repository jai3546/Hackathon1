"use server"

import { cookies } from "next/headers"

// Types for users
export type UserRole = "student" | "mentor" | "school"

export interface User {
  id: string
  name: string
  role: UserRole
  region: string
  classLevel?: number
  preferredLanguage?: string
}

// Login function
export async function login(username: string, password: string) {
  try {
    const response = await fetch(`${process.env.API_URL || "http://localhost:8000"}/api/v1/auth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username,
        password,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { success: false, message: data.detail || "Login failed" }
    }

    // Create session
    const session = {
      id: data.user_id,
      name: data.name,
      role: data.user_role,
      region: data.region,
      classLevel: data.class_level,
      preferredLanguage: data.preferred_language,
      token: data.access_token,
    }

    // Set session cookie
    cookies().set("session", JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    })

    return {
      success: true,
      user: session,
      redirectUrl: data.user_role === "student" ? "/student-dashboard" : "/mentor-dashboard",
    }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, message: "An unexpected error occurred" }
  }
}

// Logout function
export async function logout() {
  cookies().delete("session")
  return { success: true }
}

// Get current user
export async function getCurrentUser(): Promise<(User & { token: string }) | null> {
  const sessionCookie = cookies().get("session")

  if (!sessionCookie) {
    return null
  }

  try {
    return JSON.parse(sessionCookie.value) as User & { token: string }
  } catch (error) {
    return null
  }
}
