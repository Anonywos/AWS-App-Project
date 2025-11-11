export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";


type RegisterPayload = {
    full_name: string;
    username: string;
    email: string;
    password: string;
};


type LoginPayload = {
    email_or_username: string;
    password: string;
};


export async function apiRegister(data: RegisterPayload) {
    const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}


export async function apiLogin(data: LoginPayload) {
    const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}


export async function apiLogout() {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
}


export async function apiGetMe() {
    const res = await fetch(`${API_BASE}/users/me`, { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}


export async function apiUpdateMe(data: Partial<RegisterPayload> & {
image_url?: string | null;
description?: string | null;
password?: string;
}) {
    const res = await fetch(`${API_BASE}/users/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}