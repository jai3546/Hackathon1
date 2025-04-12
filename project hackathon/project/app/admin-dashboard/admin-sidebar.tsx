"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { logout } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"
import { BarChart3, BookOpen, ChevronLeft, ChevronRight, LogOut, School, Settings, Users } from "lucide-react"

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    })
    router.push("/login")
  }

  const navItems = [
    {
      name: "Dashboard",
      href: "/admin-dashboard",
      icon: BarChart3,
    },
    {
      name: "Students",
      href: "/admin-dashboard/students",
      icon: Users,
    },
    {
      name: "Classes",
      href: "/admin-dashboard/classes",
      icon: School,
    },
    {
      name: "Syllabus",
      href: "/admin-dashboard/syllabus",
      icon: BookOpen,
    },
    {
      name: "Settings",
      href: "/admin-dashboard/settings",
      icon: Settings,
    },
  ]

  return (
    <div
      className={`${
        collapsed ? "w-16" : "w-64"
      } bg-white dark:bg-gray-800 h-screen transition-all duration-300 border-r border-gray-200 dark:border-gray-700 flex flex-col`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {!collapsed && <h2 className="text-xl font-bold text-vidyai-purple">VidyAI++</h2>}
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="ml-auto">
          {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </Button>
      </div>

      <div className="flex-1 py-4 overflow-y-auto">
        <nav className="px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-vidyai-purple text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <item.icon className={`h-5 w-5 ${collapsed ? "" : "mr-3"}`} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="ghost"
          className={`w-full flex items-center text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 ${
            collapsed ? "justify-center" : ""
          }`}
          onClick={handleLogout}
        >
          <LogOut className={`h-5 w-5 ${collapsed ? "" : "mr-2"}`} />
          {!collapsed && <span>Logout</span>}
        </Button>
      </div>
    </div>
  )
}
