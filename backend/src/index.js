require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const { hashPassword, verifyPassword, createAccessToken, decodeToken } = require('./auth');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8000;
const FRONT_ORIGIN = process.env.FRONT_ORIGIN || 'http://localhost:3000';
const COOKIE_SECURE = (process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true';

app.use(cors({ origin: FRONT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

function setAuthCookie(res, token) {
    res.cookie('access_token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: COOKIE_SECURE,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
    });
}

function clearAuthCookie(res) {
    res.clearCookie('access_token', { path: '/' });
}

async function getCurrentUser(req) {
    const token = req.cookies?.access_token;
    const sub = token ? decodeToken(token) : null;
    if (!sub) return null;
    return await prisma.user.findFirst({ where: { OR: [{ email: sub }, { username: sub }] } });
}


app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/auth/register', async (req, res) => {
    try {
        const { full_name, username, email, password } = req.body;
        if (!full_name || !username || !email || !password) {
            return res.status(400).json({ detail: 'Campos obrigatórios ausentes' });
        }


        const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
        if (exists) return res.status(409).json({ detail: 'Email ou username já existe' });


        const user = await prisma.user.create({
            data: {
                full_name,
                username,
                email,
                password_hash: hashPassword(password),
            },
        });


        const token = createAccessToken(user.email);
        setAuthCookie(res, token);


        const { password_hash, ...safe } = user;
        res.json(safe);
    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: 'Erro interno' });
    }
});

app.post('/auth/login', async (req, res) => {
    try {
        const { email_or_username, password } = req.body;
        if (!email_or_username || !password) return res.status(400).json({ detail: 'Credenciais ausentes' });


        const user = await prisma.user.findFirst({ where: { OR: [{ email: email_or_username }, { username: email_or_username }] } });
        if (!user || !verifyPassword(password, user.password_hash)) return res.status(400).json({ detail: 'Credenciais inválidas' });


        const token = createAccessToken(user.email);
        setAuthCookie(res, token);


        const { password_hash, ...safe } = user;
        res.json(safe);
    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: 'Erro interno' });
    }
});


app.post('/auth/logout', async (_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
});
app.get('/users/me', async (req, res) => {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ detail: 'Não autenticado' });
    const { password_hash, ...safe } = user;
    res.json(safe);
});


app.put('/users/me', async (req, res) => {
    const authUser = await getCurrentUser(req);
    if (!authUser) return res.status(401).json({ detail: 'Não autenticado' });


    const { full_name, username, image_url, description, password } = req.body;


    try {
        if (username && username !== authUser.username) {
            const exists = await prisma.user.findUnique({ where: { username } });
            if (exists) return res.status(409).json({ detail: 'Username já em uso' });
        }


        const updated = await prisma.user.update({
            where: { id: authUser.id },
            data: {
            full_name: full_name ?? authUser.full_name,
            username: username ?? authUser.username,
            image_url: image_url === undefined ? authUser.image_url : image_url,
            description: description === undefined ? authUser.description : description,
            password_hash: password ? hashPassword(password) : authUser.password_hash,
            },
        });


        const { password_hash, ...safe } = updated;
        res.json(safe);
    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: 'Erro ao atualizar' });
    }
});

app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));