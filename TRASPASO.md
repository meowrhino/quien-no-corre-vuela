# TRASPASO — Quien no corre, vuela

Cómo pasar la tienda entera a Andrea, para que **nosotros no sirvamos la web**.

Este documento es distinto de [NEXT_STEPS.md](NEXT_STEPS.md): aquel es lo que falta para
**abrir** la tienda; este es lo que falta para que la tienda **no dependa de nosotros**.

---

## 1. Estado real, verificado el 2026-09-02

Comprobado desde fuera, no de memoria:

| Pieza | Dónde está | Cómo se comprobó |
|---|---|---|
| **La tienda viva** | `https://quiennocorrevuela.com` | Sirve 6 productos y lecturas vivas de D1 |
| **Su base de datos** | D1 `57f55099-2e3f-4ea5-827f-232224cf3f70` | Es el `database_id` de `wrangler.toml` |
| **La cuenta Cloudflare** | **NO es la de manu** | Se borró el Worker de manu y el dominio siguió sirviendo |
| **Repo del cliente** | `github.com/Quiennocorrevuela/ecommerce` | Remoto `ecommerce` en este repo |
| **Repo de manu** | `github.com/meowrhino/quien-no-corre-vuela` | Remoto `origin` |

> **Lo importante:** la infraestructura ya no vive en la cuenta de manu. El Worker de pruebas
> `quien-no-corre-vuela.manuellatourf.workers.dev` **se borró el 2026-09-02** junto con sus
> tablas huérfanas. El traspaso técnico está casi hecho; lo que queda es sobre todo
> **titularidad, claves y saber usarlo**.

## 2. Lo que NO se puede ver desde fuera — preguntar a Andrea

Antes de la reunión hay que aclarar esto, porque cambia el resto del plan:

- [ ] **¿A nombre de quién está la cuenta de Cloudflare?** ¿La abrió manu con su email, o es de
      Andrea? Si el email de acceso es de manu, la tienda es suya sobre el papel aunque
      funcione. **Esto es lo primero que hay que resolver.**
- [ ] **¿A nombre de quién está el dominio `quiennocorrevuela.com`?** Registrador, quién paga
      la renovación, y en qué cuenta está la zona DNS.
- [ ] **¿A nombre de quién está la cuenta de Stripe?** El IBAN de cobro debe ser el de ella.
- [ ] **¿Quién tiene el `ADMIN_TOKEN`?** Es la clave de `/admin/`, donde están los pedidos con
      nombres y direcciones de compradores.
- [ ] **¿El webhook de Stripe a qué URL apunta?** `NEXT_STEPS.md` lo dejó apuntando al Worker
      de pruebas que ya no existe. Si sigue así, **los pedidos no se registran ni baja el
      stock**. Debe apuntar a `https://quiennocorrevuela.com/api/stripe-webhook`.

## 3. El traspaso, paso a paso

### 3.1 Si la cuenta de Cloudflare ya es de Andrea
Lo más probable. Entonces solo hay que **quitarle a manu el acceso**:

- [ ] Dashboard → Manage Account → Members → quitar el usuario de manu.
- [ ] Andrea comprueba que puede entrar sola y ve el Worker en Workers & Pages.
- [ ] Andrea se pone 2FA en su cuenta de Cloudflare.

### 3.2 Si la cuenta es de manu (hay que mover la tienda)
D1 **no se transfiere entre cuentas**: se exporta y se importa.

- [ ] Andrea crea su cuenta de Cloudflare y añade el dominio (zona DNS).
- [ ] Exportar la base actual:
      `npx wrangler d1 export shop --remote --output=qnc-traspaso.sql`
- [ ] Con la sesión de Andrea (`npx wrangler logout && npx wrangler login`):
      `npx wrangler d1 create shop`
- [ ] Pegar el nuevo `database_id` en `wrangler.toml` y hacer push.
- [ ] Importar los datos: `npx wrangler d1 execute shop --remote --file=qnc-traspaso.sql`
- [ ] `npx wrangler deploy` desde su cuenta.
- [ ] Añadir el dominio: Worker → Settings → Domains & Routes → Custom domain.
- [ ] Comprobar que la tienda responde en el dominio **antes** de apagar la anterior.
- [ ] Apagar la anterior (`npx wrangler delete --name quien-no-corre-vuela` en la cuenta vieja).

### 3.3 Stripe (no se transfiere: tiene que ser suya)
- [ ] La cuenta de Stripe debe estar a nombre de Andrea, con su IBAN verificado.
- [ ] Ella genera la `sk_live_…` y la pone: `npx wrangler secret put STRIPE_SECRET_KEY`.
- [ ] Rehacer el webhook desde SU dashboard → endpoint
      `https://quiennocorrevuela.com/api/stripe-webhook`, evento `checkout.session.completed`.
- [ ] `npx wrangler secret put STRIPE_WEBHOOK_SECRET` con el signing secret nuevo.
- [ ] Quitar a manu de los miembros del equipo de Stripe, si estaba.

> Los secretos **no viajan** con el código ni con la base: hay que volver a ponerlos en la
> cuenta destino, uno por uno. Son `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `ADMIN_TOKEN`.

### 3.4 El repositorio
- [ ] Decidir cuál es el repo bueno. **Recomendación: el de ella**
      (`Quiennocorrevuela/ecommerce`), y que el de manu quede como copia o se archive.
- [ ] Falta empujarle un commit: `git push ecommerce main` (lleva `src/notify.js`, los avisos
      por email).
- [ ] Limpiar antes de entregar: `WEB_MANU/` y `referencias/` son material de trabajo y
      **no están versionados**; decidir si se le entregan aparte o se tiran.
- [ ] Si hay Workers Builds conectado al repo de manu, reconectarlo al de ella.

### 3.5 Correo
- [ ] Si se enciende lo de `NEXT_STEPS.md §1bis`, el dominio debe estar dado de alta en
      **Email Sending** dentro de la cuenta de ella, no de manu.

## 4. Comprobación final (hacerlo con ella delante)

- [ ] Compra de prueba real, importe pequeño, tarjeta suya.
- [ ] El pedido aparece en `https://quiennocorrevuela.com/admin/` con dirección y estado.
- [ ] El stock bajó en el producto comprado.
- [ ] El dinero aparece en **su** dashboard de Stripe.
- [ ] Ella cambia el estado del pedido a "enviado" y ve que se guarda.
- [ ] Ella entra en Cloudflare **sin ayuda de manu** y encuentra el Worker.
- [ ] Reembolsar la compra de prueba desde Stripe.

## 5. Lo que Andrea necesita saber para llevarlo sola

Explicárselo en la reunión, no por escrito:

1. **Añadir o cambiar un producto** = editar `public/data/productos.json` en GitHub y guardar.
   Cloudflare redespliega sola en ~30 s. No hay panel de productos, y es a propósito:
   así el precio no se puede manipular desde el navegador.
2. **Cambiar el stock** = `/admin/stock.html`. Eso sí es un panel.
3. **Ver los pedidos** = `/admin/tickets.html`, con estados (pendiente → enviado → entregado).
4. **Los cupones** se crean en Stripe, no en la web (Products → Coupons → Promotion codes).
5. **Si algo se rompe** el historial de pagos está en Stripe pase lo que pase, y D1 tiene
   *Time Travel* (30 días atrás). Backup manual:
   `npx wrangler d1 export shop --remote --output=backup.sql`.

## 6. Qué se queda manu

- [ ] Nada de infraestructura: ni cuenta, ni dominio, ni claves, ni acceso a `/admin/`.
- [ ] El código, como plantilla reutilizable — pero eso ya vive en
      [semillaEcommerce](https://github.com/meowrhino/semillaEcommerce), no aquí.
- [ ] Acordar por escrito si hay mantenimiento después y en qué condiciones. Si no lo hay,
      decirlo explícitamente: a partir de la entrega, un cambio de código lo hace quien ella
      contrate.

---

*Última verificación del estado: 2026-09-02.*
