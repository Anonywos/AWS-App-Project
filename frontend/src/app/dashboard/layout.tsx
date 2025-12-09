"use client"

import type React from "react"

import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Upload, User, Menu, X } from "lucide-react"
import { userType } from "./page"
import { useEffect } from "react"
import { apiGetMe } from "@/lib/api"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<userType>({
    full_name: "",
    username: "",
    email: "",
    image_url: null,
    description: null,
    created_at: "",
  })
  
  useEffect(() => {
    ;(async () => {
      const u = await apiGetMe()
      if (!u) {
        router.replace("/login")
        return
      }
      setUser(u)
      setLoading(false)
    })()
  }, [router])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const navigation = [
    { name: "Perfil", href: "/dashboard", icon: User },
    { name: "Uploads", href: "/dashboard/uploads", icon: Upload },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-lg bg-card border border-border p-2 text-foreground shadow-lg hover:bg-accent"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-card border-r border-border transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* User profile section */}
          <div className="border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted ring-2 ring-border">
                {user?.image_url ? (
                  <img
                    src={user.image_url || "/placeholder.svg"}
                    alt={user.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-xl font-semibold">
                    {user?.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-foreground truncate">{user?.full_name}</h2>
                <p className="text-xs text-muted-foreground truncate">@{user?.username}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    router.push(item.href)
                    setSidebarOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.name}
                </button>
              )
            })}
          </nav>

          {/* Logout button */}
          <div className="border-t border-border p-4">
            <button
              onClick={() => router.push("/login")}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  )
}
