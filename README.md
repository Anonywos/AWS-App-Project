AWS App Project — Next.js + Express.js + Prisma/SQLite

Aplicação full-stack simples com Login e Dashboard de usuário.
Permite criar conta (e-mail/senha) e, autenticado, visualizar/editar os dados do perfil.

Acesse em produção:
👉 http://56.125.247.198

Healthcheck da API: http://56.125.247.198/api/health

🧠 Lógica da aplicação

Autenticação: e-mail + senha. A senha é hasheada no backend antes de salvar (ex.: bcrypt).

Sessão/Token: o backend emite um cookie/ token (dependendo da sua implementação) após login bem-sucedido.

Dashboard: estando autenticado, o usuário pode atualizar seus dados:

full_name, username, email, password(hash), profile_image(URL), description

created_at é gerado automaticamente

Persistência: Prisma com SQLite (arquivo único, ideal para MVP).

CORS/Origem: o backend valida a origem (FRONT_ORIGIN) para permitir requisições do front.

🏗️ Arquitetura (alto nível)
[Cliente] ──HTTP──> [Nginx: :80]
   ├ /api/*  ─────> proxy → http://127.0.0.1:8000  (Express)
   └ /*      ─────> proxy → http://127.0.0.1:3000  (Next.js)


Nginx atua como reverse proxy:

Tudo que começa com /api/ vai para o Express (porta 8000).

Todo o resto vai para o Next.js (porta 3000).

systemd mantém frontend e backend sempre rodando (reinício automático).

ℹ️ Detalhe do proxy: o bloco location /api/ { proxy_pass http://127.0.0.1:8000/; } remove o prefixo /api/ ao encaminhar (ex.: /api/health → /health). Isso acontece porque o proxy_pass termina com /.

🧰 Tecnologias

Frontend: Next.js 16 (React + TypeScript + Tailwind)

Backend: Node.js + Express.js

ORM: Prisma

Banco: SQLite (arquivo em backend/prisma/prod.db)

Infra: Ubuntu em AWS EC2, Nginx (reverse proxy), systemd (process manager)

📁 Estrutura de pastas
AWS-App-Project/
├─ backend/
│  ├─ src/                 # rotas/middlewares Express
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ prod.db           # SQLite (produção)
│  ├─ package.json
│  └─ .env                 # variáveis do backend (produção/dev)
└─ frontend/
   ├─ src/                 # app Next.js
   ├─ package.json
   └─ .env.local           # URL da API que o front consome

🔐 Variáveis de ambiente
backend/.env
PORT=8000
DATABASE_URL="file:./prod.db"      # cria/usa backend/prisma/prod.db
FRONT_ORIGIN=http://56.125.247.198 # troque por seu domínio quando tiver HTTPS
SECRET_KEY=uma-chave-forte-aqui
ACCESS_TOKEN_EXPIRE_MINUTES=60
COOKIE_SECURE=false                # mude para true em HTTPS

frontend/.env.local
NEXT_PUBLIC_API_BASE=http://56.125.247.198/api
# em HTTPS + domínio:
# NEXT_PUBLIC_API_BASE=https://seu-dominio.com/api

💻 Desenvolvimento local

Sempre indico a pasta antes do comando.

1) Backend

Pasta: backend/

cd backend
npm install
npx prisma migrate dev --name init --schema prisma/schema.prisma
npm run dev
# API: http://localhost:8000

2) Frontend

Pasta: frontend/

cd frontend
npm install
echo "NEXT_PUBLIC_API_BASE=http://localhost:8000/api" > .env.local
npm run dev
# Front: http://localhost:3000


Testes:

Front: http://localhost:3000/login

API: curl -i http://localhost:8000/health

🚀 Deploy na AWS EC2 (produção)
0) Pré-requisitos (na EC2)
sudo apt update
sudo apt -y install nginx
node -v && npm -v   # Node 18+ (usamos 22.x)

1) Backend (produção)

Pasta: /opt/app/AWS-App-Project/backend

cd /opt/app/AWS-App-Project/backend
cp .env.example .env  # se existir; senão crie conforme seção acima
npm install
# aplica migrações (sem alterar schema)
npx prisma migrate deploy --schema prisma/schema.prisma

2) Frontend (produção)

Pasta: /opt/app/AWS-App-Project/frontend

cd /opt/app/AWS-App-Project/frontend
echo "NEXT_PUBLIC_API_BASE=http://56.125.247.198/api" > .env.local
npm install
npm run build

3) Nginx (reverse proxy)

Arquivo: /etc/nginx/sites-available/myapp

server {
    listen 80 default_server;
    server_name 56.125.247.198 127.0.0.1 localhost _;

    client_max_body_size 10m;

    # /api → backend (Express)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;   # /api/foo → /foo
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # resto → frontend (Next)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}


Ativar:

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/myapp /etc/nginx/sites-enabled/myapp
sudo nginx -t && sudo systemctl reload nginx

4) Serviços systemd (mantém tudo ligado)

Backend — /etc/systemd/system/app-backend.service

[Unit]
Description=App Backend (Express)
After=network.target

[Service]
WorkingDirectory=/opt/app/AWS-App-Project/backend
EnvironmentFile=/opt/app/AWS-App-Project/backend/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
User=ubuntu
Group=ubuntu

[Install]
WantedBy=multi-user.target


Frontend — /etc/systemd/system/app-frontend.service

[Unit]
Description=App Frontend (Next.js)
After=network.target

[Service]
WorkingDirectory=/opt/app/AWS-App-Project/frontend
ExecStart=/usr/bin/npm run start -- --port 3000
Restart=always
RestartSec=5
User=ubuntu
Group=ubuntu
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target


Ativar e iniciar:

sudo systemctl daemon-reload
sudo systemctl enable --now app-backend
sudo systemctl enable --now app-frontend


Testar via Nginx:

curl -i http://127.0.0.1/api/health
curl -I http://127.0.0.1/

🌐 Como funciona o proxy (explicação rápida)

O Nginx recebe todas as requisições na porta 80.

Se a URL começar com /api/, a requisição é redirecionada para o Express (porta 8000).

Como usamos location /api/ + proxy_pass http://127.0.0.1:8000/; (com barra final), o Nginx remove o prefixo /api/ ao encaminhar.
Ex.: GET /api/health → Express recebe GET /health.

Qualquer outra rota (ex.: /, /login, /dashboard) é repassada para o Next.js (porta 3000), que serve as páginas do front.

Isso permite ter um único endpoint público (IP/domínio) e separar front e back internamente.

🧪 URLs de teste (produção)

Frontend: http://56.125.247.198

Login: http://56.125.247.198/login

Health da API: http://56.125.247.198/api/health

Quando migrar para domínio + HTTPS, substitua 56.125.247.198 por seu-dominio.com e ajuste as envs:

FRONT_ORIGIN=https://seu-dominio.com

NEXT_PUBLIC_API_BASE=https://seu-dominio.com/api

COOKIE_SECURE=true

🛠️ Troubleshooting

Frontend cai em produção:
Rode o build antes do next start:
Pasta: frontend/ → npm run build

Nginx mostra página padrão:
Remova o site default e garanta listen 80 default_server; no seu site.

DATABASE_URL ausente no Prisma:
Confirme backend/.env e rode comandos a partir de backend/:

npx prisma migrate deploy --schema prisma/schema.prisma


502 Bad Gateway:
Veja os logs dos serviços:

sudo journalctl -xeu app-backend.service
sudo journalctl -xeu app-frontend.service

📜 Licença

Defina a licença (ex.: MIT) conforme sua necessidade.
