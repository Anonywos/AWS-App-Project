"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiLogin, apiRegister } from "@/lib/api";


export default function LoginPage() {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();


    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        const form = new FormData(e.currentTarget);


        try {
            if (mode === "register") {
                await apiRegister({
                full_name: String(form.get("full_name")),
                username: String(form.get("username")),
                email: String(form.get("email")),
                password: String(form.get("password")),
                });
            } else {
                await apiLogin({
                email_or_username: String(form.get("email_or_username")),
                password: String(form.get("password")),
            });
            }
            router.push("/dashboard");
        } catch (err: any) {
            setError(err?.message ?? "Erro inesperado");
        } finally {
            setLoading(false);
        }
    }
    return (
    <div className="min-h-screen flex items-center justify-center bg-rose-50 p-4">
        <div className="w-full max-w-md bg-white shadow rounded-2xl p-6">
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setMode("login")}
                    className={`flex-1 rounded-xl px-4 py-2 border ${mode === "login" ? "bg-slate-100" : ""}`}
                >
                Login
                </button>
                <button
                    onClick={() => setMode("register")}
                    className={`flex-1 rounded-xl px-4 py-2 border ${mode === "register" ? "bg-slate-100" : ""}`}
                >
                Criar conta
                </button>
            </div>


            <form onSubmit={onSubmit} className="space-y-3">
                {mode === "register" ? (
                    <>
                    <input name="full_name" placeholder="Nome completo" className="w-full border rounded-xl px-3 py-2" required />
                    <input name="username" placeholder="Username" className="w-full border rounded-xl px-3 py-2" required />
                    <input name="email" type="email" placeholder="Email" className="w-full border rounded-xl px-3 py-2" required />
                    <input name="password" type="password" placeholder="Senha" className="w-full border rounded-xl px-3 py-2" required />
                    </>
                ) : (
                    <>
                    <input name="email_or_username" placeholder="Email ou username" className="w-full border rounded-xl px-3 py-2" required />
                    <input name="password" type="password" placeholder="Senha" className="w-full border rounded-xl px-3 py-2" required />
                    </>
                )}


                {error && <p className="text-sm text-red-600">{error}</p>}


                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl px-4 py-2 border hover:bg-slate-100 disabled:opacity-50"
                >
                {loading ? "Enviando..." : mode === "register" ? "Criar conta" : "Entrar"}
                </button>
            </form>
        </div>
    </div>
    );
}