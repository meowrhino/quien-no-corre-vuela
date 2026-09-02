# Quien no corre, vuela

Tienda online de la editorial de fanzines **Quien no corre, vuela**.

Web + API en un único **Cloudflare Worker** (con *static assets*) · catálogo en JSON · **D1** para
stock/pedidos/newsletter/mensajes · **Stripe** para el pago. Trilingüe **ES / CA / EN**.

**En vivo:** https://quiennocorrevuela.com · auto-deploy en cada `git push` (Workers Builds)

## Estructura
```
public/            La web (Cloudflare la sirve como static assets)
  *.html           home, producto, checkout, about, newsletter, contacto, autores, autor, calendario…
  js/core/         config · i18n · data · cart · ui · layout   (ES modules)
  js/pages/        un módulo por página
  css/  img/  admin/
  data/            ← contenido editable (ver abajo)
src/index.js       El Worker: solo /api/* (Hono). El resto lo sirven los assets de public/.
src/notify.js      Avisos por email (pedidos y mensajes). Apagado si EMAIL_TIENDA está vacío.
wrangler.toml      main, [assets] directory=public, binding D1 (DB → shop)
```
El material fuente (`WEB_MANU/`, `referencias/`) queda en la raíz y **no** se publica.

## El contenido vive en JSON (no en la base de datos)
Para gestionar la tienda se editan archivos en `public/data/` y se hace deploy:

| Archivo | Qué |
|---|---|
| `productos.json` | catálogo: título (multi-línea), autor, precio, `peso` (envío), imágenes, ficha técnica i18n, descripción i18n |
| `envios.json` | zonas y tarifas por peso |
| `autores.json` | autoras + bio |
| `eventos.json` | calendario de ferias/eventos |

La **D1** (`shop`) solo guarda lo que cambia solo: `stock`, `pedidos`, `newsletter`, `mensajes`.
El precio nunca se fía del navegador: el Worker lo revalida contra el JSON.

## Desarrollo
```bash
npm install
npm run preview     # maqueta sin backend → http://localhost:8123
npm run dev         # Worker completo (D1 + Stripe) en local
npm run deploy      # publica el Worker
```

## Despliegue, secretos y dominio
Ver **[DEPLOY.md](DEPLOY.md)**. Resumen: la D1 está enlazada por `wrangler.toml`; los secretos
(`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_TOKEN`) se ponen con `npx wrangler secret put`;
el dominio en el dashboard → el Worker → Settings → Domains & Routes.

## Idiomas
Toggle ES→CA→EN en la cabecera. Textos de interfaz en `public/js/core/i18n.js`; los campos de
contenido son objetos `{es,ca,en}` dentro de los JSON.

## Admin
`/admin/` con el `ADMIN_TOKEN`: pedidos, stock, altas de newsletter y mensajes de contacto.

## Avisos por email
`src/notify.js` manda cuatro avisos: **pedido nuevo** y **mensaje de contacto** a la tienda,
**confirmación** y **pedido enviado** al cliente. Ahora mismo están **apagados**: con
`EMAIL_TIENDA` vacío en `wrangler.toml` no se manda nada y todo funciona igual (se loguea).

Para encenderlos (ver los pasos exactos en `wrangler.toml` y **[NEXT_STEPS.md](NEXT_STEPS.md)**):
dar de alta el dominio en Email Sending, verificar el email de destino, rellenar `EMAIL_TIENDA`
y descomentar el bloque `[[send_email]]`.

Los avisos **a la tienda** son gratis en plan free (el destino está verificado en la cuenta).
Los avisos **al cliente** requieren Workers Paid o una clave de `RESEND_API_KEY`; hasta
entonces fallan solos y se loguean, sin afectar al resto. El recibo de compra ya lo manda Stripe.

## Newsletter
La página `/newsletter` **recoge** emails y los guarda en D1 (sin duplicados); se ven en
`/admin/newsletter.html`. **No envía** boletines por sí sola: es una lista de suscripción. Para
mandar un envío se exporta la lista y se usa una herramienta externa (Mailchimp, Buttondown…).
No hay doble opt-in ni baja automática — tenerlo en cuenta en la política de privacidad.

---
Construido a partir de [semillaEcommerce](https://github.com/meowrhino/semillaEcommerce).
