# Despliegue — Quien no corre, vuela

Stack: **Cloudflare Pages** (web estática) + **Pages Functions** (API Hono) + **D1** (stock, pedidos,
newsletter, mensajes) + **Stripe Checkout** (pagos). Todo gratis bajo una cuenta de Cloudflare.

> Los pasos con 🔐 los tienes que hacer **tú**: implican login OAuth o introducir claves secretas
> (Stripe, ADMIN_TOKEN). Por seguridad no se automatizan ni se guardan en el repo.

## 0. Requisitos
- Cuenta en [Cloudflare](https://dash.cloudflare.com) y en [Stripe](https://dashboard.stripe.com).
- `node` y este repo clonado. `npm install`.

## 1. 🔐 Login en Cloudflare
```bash
npx wrangler login
```

## 2. Crear la base de datos D1
```bash
npx wrangler d1 create shop
```
Copia el `database_id` que devuelve y pégalo en [`wrangler.toml`](wrangler.toml) (reemplaza
`PEGA_AQUI_EL_ID_DEVUELTO_POR_D1_CREATE`). Luego crea las tablas:
```bash
npm run db:init          # remoto (producción)
npm run db:init:local    # local (desarrollo)
```

## 3. Conectar el repo a Pages
Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git** →
elige este repo. Configuración:
- **Production branch:** `main`
- **Framework preset:** None · **Build command:** (vacío) · **Build output directory:** `/`

Cada `git push` a `main` redespliega solo.

## 4. Enlazar la D1 al sitio
Settings → **Functions** → **D1 database bindings** → Add binding: variable `DB` → base de datos `shop`.

## 5. 🔐 Secretos de producción
Settings → **Environment variables** → **Production** → Add (marca **Encrypted**):

| Variable | Valor |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` o `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (paso 6) |
| `ADMIN_TOKEN` | un string largo inventado; lo usarás en `/admin/` |
| `FRONTEND_URL` | p.ej. `https://quiennocorre.com` |

Tras añadirlos: **Deployments → Retry deployment**.

## 6. 🔐 Webhook de Stripe
Stripe → Developers → **Webhooks** → Add endpoint:
- URL: `https://TU-DOMINIO/api/stripe-webhook`
- Evento: `checkout.session.completed`
- Copia el **Signing secret** → actualiza `STRIPE_WEBHOOK_SECRET` y relanza el deploy.

## 7. Dominio propio
Pages → **Custom domains** → añade tu dominio. Si el DNS ya está en Cloudflare, HTTPS automático en
1–2 min. Acuérdate de poner ese dominio en `FRONTEND_URL`.

## Desarrollo local
```bash
node serve.mjs     # maquetación rápida sin Functions → http://localhost:8123
npm run dev        # completo (Functions + D1 + Stripe) → http://localhost:8788
```
Secretos locales en `.dev.vars` (copia de `.dev.vars.example`, ignorado por git).

## Admin
`https://TU-DOMINIO/admin/` → guarda el `ADMIN_TOKEN` → pedidos, stock, newsletter y mensajes.
