# NEXT STEPS — Quien no corre, vuela

El código está completo y desplegado (2026-07-07). Esto es lo que queda para **abrir la
tienda**, en orden. Nada de esto es programar: son claves, contenido y comprobaciones.

## 1. Stripe (con Andrea)
- [ ] Andrea crea la cuenta de Stripe y verifica el IBAN.
- [ ] manu mete la clave: `npx wrangler secret put STRIPE_SECRET_KEY` (primero la `sk_test_…`).
- [ ] Webhook: Stripe → Developers → Webhooks → Add endpoint →
      `https://quien-no-corre-vuela.manuellatourf.workers.dev/api/stripe-webhook`
      (o el dominio propio), evento `checkout.session.completed` →
      `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.
- [ ] `npx wrangler secret put ADMIN_TOKEN` si aún no está (activa `/admin/`).
- [ ] Dashboard de Stripe: activar **Bizum** (Settings → Payment methods) y **recibos**
      (Settings → Emails → Successful payments). Cupones: Products → Coupons → Promotion codes.

## 1bis. Avisos por email (código listo, falta encenderlo)
El Worker ya manda cuatro avisos (`src/notify.js`), pero están **apagados**: `EMAIL_TIENDA`
está vacío en `wrangler.toml`. Sin esto, nadie se entera de que ha entrado un pedido — hay
que acordarse de mirar `/admin/tickets.html`.

- [ ] **Decidir el email de la tienda** (el de Andrea, o uno nuevo). Es el que recibirá los
      pedidos y los mensajes de contacto.
- [ ] Dar de alta el dominio en Email Sending:
      `npx wrangler email sending enable quiennocorrevuela.com`
      ⚠️ Añade SPF (TXT) y DKIM (CNAME). **Si el dominio ya tiene un registro SPF, hay que
      fusionarlos, no poner dos** — dos SPF rompen la autenticación.
      ⚠️ No confundir con Email **Routing**: ese añade **MX** y rompería el correo entrante
      del dominio si ya se usa.
- [ ] Verificar el destino: `npx wrangler email routing addresses create <email-de-andrea>`
      (llega un correo con un enlace; hay que pinchar). Esto es lo que hace que los avisos
      internos sean **gratis en plan free**.
- [ ] Rellenar `EMAIL_TIENDA` y `EMAIL_RESPUESTA` en `wrangler.toml`, descomentar el bloque
      `[[send_email]]` y hacer push.
- [ ] Comprobarlo en la compra de prueba del punto 3.
- [ ] *Opcional, de pago:* los avisos **al cliente** (confirmación y "pedido enviado") necesitan
      **Workers Paid** (~5 $/mes) o `npx wrangler secret put RESEND_API_KEY`. Sin eso fallan
      solos y se loguean; los avisos internos salen igual. El recibo de compra ya lo manda Stripe.
- [ ] Nota: `npx wrangler email sending list` da `Unauthorized [code: 2036]` con el token
      actual — hace falta un `npx wrangler login` nuevo para que coja el permiso de email.

## 2. Contenido (cliente)
- [ ] `public/legal.html`: sustituir los `[CORCHETES]` (nombre fiscal, NIF, dirección, email,
      plazo de preparación).
- [ ] Precios reales en `productos.json`: black-cover, i-am-the-center, no-time-left (placeholder).
- [ ] Pesos reales (`peso`, gramos) y tarifas reales en `envios.json` (ahora estimaciones).
- [ ] Bios de autoras (`autores.json` sigue con TODO).

## 3. Prueba y apertura
- [ ] Compra de prueba en modo test con `gatito` (tarjeta `4242 4242 4242 4242`) → el pedido
      sale en `/admin/tickets.html` con dirección, zona y estado, y **llega el aviso por email**
      (si el punto 1bis está hecho).
- [ ] Borrar `gatito` de `productos.json` (+ su imagen) y push.
- [ ] Cambiar a la clave live (`wrangler secret put STRIPE_SECRET_KEY` con `sk_live_…`) y
      recrear el webhook en modo live.
- [ ] Dominio propio: dashboard → Worker → Settings → Domains & Routes.

## 4. Mantenimiento
- **Backup**: sin backup automático (se quitó para simplificar). Red de seguridad: *Time Travel*
      de D1 (30 días) + los pagos quedan en Stripe. Backup manual puntual si se quiere:
      `npx wrangler d1 export shop --remote --output=backup.sql`.
- [ ] Opcional: conectar Workers Builds (dashboard → Worker → Settings → Builds) para que cada
      push despliegue solo. Ver DEPLOY.md.
- [ ] Limpieza acordada: quitar `WEB_MANU/` y `referencias/` del repo.
