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

type GetVideo = {
    id: string,
    quality: string,
}

// type FileUploadPayload = {
//     file: File;
//     name: string;
//     tags: string[];
//     description?: string;
// };

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

export async function apiPostFile(formData: FormData) {
    const res = await fetch(`${API_BASE}/media/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function apiGetAllFiles() {
    const res = await fetch(`${API_BASE}/media/list`, {
        method: "GET",
        credentials: "include",
    })
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function apiGetFileById(id: string) {
    const res = await fetch(`${API_BASE}/media/${id}`, {
        method: "GET",
        credentials: "include",
    })
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

export async function apiDeleteFile(key: string) {
    const res = await fetch(`${API_BASE}/media/${encodeURIComponent(key)}`, {
        method: "DELETE",
        credentials: "include",
    })
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}