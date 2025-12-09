"use client"
import { useEffect, useState } from "react"
import type React from "react"

import { useRouter } from "next/navigation"
import { apiGetMe, apiLogout, apiUpdateMe } from "@/lib/api"

export interface userType {
  full_name: string
  username: string
  email: string
  image_url: string | null
  description: string | null
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    try {
      const updated = await apiUpdateMe({
        full_name: String(form.get("full_name")),
        username: String(form.get("username")),
        image_url: String(form.get("image_url")) || null,
        description: String(form.get("description")) || null,
        password: String(form.get("password")) || undefined,
      })
      setUser(updated)
    } catch (err: any) {
      setError(err?.message ?? "Erro ao salvar")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-muted ring-2 ring-border">
                {user.image_url ? (
                  <img
                    src={user.image_url || "/placeholder.svg"}
                    alt={user.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-lg font-semibold">
                    {user.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground">{user.full_name}</h1>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              </div>
            </div>
            <button
              onClick={async () => {
                await apiLogout()
                router.push("/login")
              }}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-4 h-32 w-32 overflow-hidden rounded-full bg-muted ring-4 ring-border">
                  {user.image_url ? (
                    <img
                      src={user.image_url || "/placeholder.svg"}
                      alt={user.full_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary text-primary-foreground text-5xl font-bold">
                      {user.full_name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-bold text-foreground">{user.full_name}</h2>
                <p className="text-sm text-muted-foreground mb-3">@{user.username}</p>
                {user.description && <p className="text-sm text-foreground/80 leading-relaxed">{user.description}</p>}
              </div>

              <div className="mt-6 space-y-3 border-t border-border pt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium text-foreground truncate ml-2">{user.email}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Membro desde</span>
                  <span className="font-medium text-foreground">
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground">Editar Perfil</h3>
                <p className="mt-1 text-sm text-muted-foreground">Atualize suas informações pessoais</p>
              </div>

              <form onSubmit={onSave} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="full_name" className="text-sm font-medium text-foreground">
                    Nome Completo
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    defaultValue={user.full_name}
                    placeholder="Seu nome completo"
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium text-foreground">
                    Nome de Usuário
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                    <input
                      id="username"
                      name="username"
                      defaultValue={user.username}
                      placeholder="usuario"
                      className="w-full rounded-lg border border-input bg-background pl-8 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="image_url" className="text-sm font-medium text-foreground">
                    URL da Imagem de Perfil
                  </label>
                  <input
                    id="image_url"
                    name="image_url"
                    defaultValue={user.image_url ?? ""}
                    placeholder="https://exemplo.com/sua-foto.jpg"
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cole o link de uma imagem para usar como foto de perfil
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium text-foreground">
                    Descrição
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    defaultValue={user.description ?? ""}
                    placeholder="Conte um pouco sobre você..."
                    rows={4}
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Nova Senha
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                  />
                  <p className="text-xs text-muted-foreground">Deixe em branco para manter a senha atual</p>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    Salvar Alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => router.refresh()}
                    className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
