/**
 * src/index.js — backend en un Cloudflare Worker (Hono).
 *
 * Worker con "static assets": Cloudflare sirve `public/` (la web) automáticamente y este
 * Worker solo atiende las rutas `/api/*`. Cualquier otra ruta no encontrada cae aquí y devuelve 404.
 *
 * Filosofía JAMstack (de la semilla):
 *   - CATÁLOGO (productos, precios, peso, descripciones i18n) → public/data/productos.json (source of truth).
 *   - ENVÍOS (zonas + tramos por peso) → public/data/envios.json.
 *   - D1 sólo guarda lo MUTABLE: stock vivo, pedidos, altas de newsletter y mensajes de contacto.
 *
 * El precio/nombre/peso es SIEMPRE el del JSON desplegado; el cliente no puede manipularlo.
 *
 * Bindings (wrangler.toml + .dev.vars): env.DB, env.STRIPE_SECRET_KEY,
 *   env.STRIPE_WEBHOOK_SECRET, env.ADMIN_TOKEN, env.FRONTEND_URL.
 *
 * Avisos por email (src/notify.js): env.EMAIL_FROM, env.EMAIL_TIENDA, env.EMAIL_RESPUESTA,
 *   env.TIENDA_NOMBRE + binding env.EMAIL (o env.RESEND_API_KEY). Con EMAIL_TIENDA vacío
 *   no se manda nada y todo lo demás funciona igual.
 */

import { Hono } from "hono";
import Stripe from "stripe";

import productos from "../public/data/productos.json";
import envios from "../public/data/envios.json";
import { normalizeStockInicial, precioEnvio, nombreDeZona, esZonaRecogida } from "../public/js/core/shared.js";
import {
  notifPedidoNuevo,
  notifPedidoConfirmado,
  notifMensajeNuevo,
  notifPedidoEnviado,
  enSegundoPlano,
} from "./notify.js";

const app = new Hono().basePath("/api");

// ─── helpers ─────────────────────────────────────────────
const toCents = (eur) => Math.round(Number(eur) * 100);

/** Nombre canónico de un producto (para Stripe / pedidos): título en ES. */
function nombreCanonico(p) {
  return Array.isArray(p.titulo) ? p.titulo.join(" ") : p.nombre || String(p.id);
}

function findProducto(id) {
  return productos.find((p) => String(p.id) === String(id));
}

/** Países que acepta Stripe para dirección de envío (ISO 3166-1, sin los no soportados).
 *  Se usa para zonas sin lista `paises` propia en envios.json (p. ej. "internacional"). */
const PAISES_STRIPE = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AR","AT","AU","AW","AX","AZ","BA","BB","BD","BE","BF",
  "BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BW","BY","BZ","CA","CD","CF","CG",
  "CH","CI","CK","CL","CM","CN","CO","CR","CV","CW","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC",
  "EE","EG","ER","ES","ET","FI","FJ","FK","FO","FR","GA","GB","GD","GE","GF","GG","GH","GI","GL",
  "GM","GN","GP","GQ","GR","GT","GU","GW","GY","HK","HN","HR","HT","HU","ID","IE","IL","IM","IN",
  "IQ","IS","IT","JE","JM","JO","JP","KE","KG","KH","KI","KM","KN","KR","KW","KY","KZ","LA","LB",
  "LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MK","ML","MM","MN",
  "MO","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA","NC","NE","NG","NI","NL","NO","NP",
  "NR","NU","NZ","OM","PA","PE","PF","PG","PH","PK","PL","PM","PR","PS","PT","PY","QA","RE","RO",
  "RS","RU","RW","SA","SB","SC","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST",
  "SV","SX","SZ","TC","TD","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA",
  "UG","US","UY","UZ","VA","VC","VE","VG","VN","VU","WF","WS","XK","YE","ZA","ZM","ZW",
];

/** Países permitidos para una zona: su lista `paises` del JSON, o todos los de Stripe. */
function paisesDeZona(zona) {
  return Array.isArray(zona.paises) && zona.paises.length ? zona.paises : PAISES_STRIPE;
}

/** Inicializa stock en D1 desde stockInicial. Idempotente, memoizado por isolate.
 *  Si falla (D1 caído), se descarta la promesa para que el siguiente request reintente. */
let stockInitPromise = null;
function ensureStock(env) {
  if (stockInitPromise) return stockInitPromise;
  stockInitPromise = (async () => {
    const stmts = [];
    for (const p of productos) {
      const inicial = normalizeStockInicial(p.stockInicial);
      for (const [talla, cantidad] of Object.entries(inicial)) {
        stmts.push(
          env.DB.prepare(
            `INSERT OR IGNORE INTO stock (producto_id, talla, cantidad) VALUES (?, ?, ?)`
          ).bind(String(p.id), String(talla), cantidad)
        );
      }
    }
    if (stmts.length) await env.DB.batch(stmts);
  })().catch((err) => {
    stockInitPromise = null;
    throw err;
  });
  return stockInitPromise;
}

async function fetchStock(env, productoId = null) {
  const stmt = productoId
    ? env.DB.prepare(`SELECT producto_id, talla, cantidad FROM stock WHERE producto_id = ?`).bind(productoId)
    : env.DB.prepare(`SELECT producto_id, talla, cantidad FROM stock`);
  const { results } = await stmt.all();
  const byProducto = {};
  for (const row of results) (byProducto[row.producto_id] ||= {})[row.talla] = row.cantidad;
  return byProducto;
}

function hydrateProducto(p, stockMap) {
  return { ...p, stockByTalla: stockMap[p.id] || {} };
}

// ─── catálogo ────────────────────────────────────────────
app.get("/health", (c) =>
  c.json({ ok: true, runtime: "workers", db: "d1", productos: productos.length })
);

app.get("/productos", async (c) => {
  await ensureStock(c.env);
  const stock = await fetchStock(c.env);
  const activos = productos.filter((p) => p.activo !== false);
  return c.json(activos.map((p) => hydrateProducto(p, stock)));
});

app.get("/productos/:id", async (c) => {
  await ensureStock(c.env);
  const p = findProducto(c.req.param("id"));
  if (!p || p.activo === false) return c.json({ error: "no encontrado" }, 404);
  const stock = await fetchStock(c.env, p.id);
  return c.json(hydrateProducto(p, stock));
});

app.get("/envios", (c) => c.json(envios));

app.get("/stock", async (c) => {
  await ensureStock(c.env);
  return c.json(await fetchStock(c.env));
});

// ─── Stripe checkout ─────────────────────────────────────
app.post("/crear-sesion", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const carrito = Array.isArray(body.carrito) ? body.carrito : [];
  const envioReq = body.envio || null;

  if (!carrito.length) return c.json({ error: "carrito vacío" }, 400);

  await ensureStock(c.env);

  // Resolver cada ítem contra el JSON (precio/peso) y contra D1 (stock).
  const resolved = [];
  let pesoTotal = 0;
  for (let i = 0; i < carrito.length; i++) {
    const it = carrito[i];
    const p = findProducto(it.id);
    if (!p) return c.json({ error: `producto ${it.id} no existe` }, 400);
    if (p.activo === false) return c.json({ error: `producto ${it.id} no disponible` }, 400);
    if (p.agotado === true) return c.json({ error: `producto ${it.id} agotado` }, 409);

    const cantidad = Number(it.cantidad);
    if (!Number.isInteger(cantidad) || cantidad <= 0)
      return c.json({ error: `cantidad inválida en ítem ${i}` }, 400);

    const row = await c.env.DB.prepare(
      `SELECT cantidad FROM stock WHERE producto_id = ? AND talla = '_'`
    )
      .bind(p.id)
      .first();
    const disponible = row ? Number(row.cantidad) : 0;
    if (disponible < cantidad)
      return c.json({ error: `sin stock para ${nombreCanonico(p)}`, disponible }, 409);

    pesoTotal += (Number(p.peso) || 0) * cantidad;
    resolved.push({ p, cantidad });
  }

  // Envío: obligatorio. Precio recalculado en el servidor (peso × zona), no se acepta del cliente.
  if (!envioReq?.zona) return c.json({ error: "falta la zona de envío" }, 400);
  const zonaEnvio = envios.find((e) => e.zona === envioReq.zona);
  if (!zonaEnvio) return c.json({ error: "zona de envío desconocida" }, 400);
  const envioResolved = { zona: zonaEnvio.zona, precio: precioEnvio(zonaEnvio, pesoTotal) };
  const esRecogida = esZonaRecogida(zonaEnvio);

  if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "pagos no configurados" }, 503);
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

  const line_items = resolved.map(({ p, cantidad }) => ({
    quantity: cantidad,
    price_data: {
      currency: "eur",
      product_data: { name: nombreCanonico(p), metadata: { id: String(p.id) } },
      unit_amount: toCents(p.precio),
    },
  }));

  const frontend = c.env.FRONTEND_URL || new URL(c.req.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Sin payment_method_types: Stripe usa los métodos activados en el dashboard
      // (tarjeta + wallets, y Bizum/PayPal/etc. si se activan allí, sin tocar código).
      line_items,
      // El envío va como shipping_option (no como producto): sale como envío de verdad
      // en el checkout y el recibo. En recogida no se pide dirección ni se cobra nada.
      shipping_address_collection: esRecogida
        ? undefined
        : { allowed_countries: paisesDeZona(zonaEnvio) },
      shipping_options: esRecogida
        ? undefined
        : [
            {
              shipping_rate_data: {
                type: "fixed_amount",
                display_name: nombreDeZona(zonaEnvio),
                fixed_amount: { amount: toCents(envioResolved.precio), currency: "eur" },
              },
            },
          ],
      // Campo "¿tienes un código?" en el checkout; los códigos se crean en el dashboard.
      allow_promotion_codes: true,
      // La sesión caduca en 30 min (mínimo de Stripe): acorta la ventana en la que
      // alguien puede pagar stock que ya voló (el stock se descuenta en el webhook).
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: `${frontend}/gracias.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontend}/sorry.html`,
      // Metadata mínima (límite Stripe: 500 chars/valor): solo id+cantidad.
      // El webhook re-enriquece nombre/precio desde productos.json.
      metadata: {
        carrito: JSON.stringify(resolved.map(({ p, cantidad }) => ({ id: p.id, cantidad }))),
        zona: envioResolved.zona,
      },
    });
    return c.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error("Stripe session error:", err?.message || err);
    return c.json({ error: "no se pudo crear la sesión" }, 500);
  }
});

/** Estado de una sesión de checkout (para gracias.html: confirmar antes de vaciar carrito). */
app.get("/session-status", async (c) => {
  const id = c.req.query("session_id");
  if (!id) return c.json({ error: "session_id requerido" }, 400);
  if (!c.env.STRIPE_SECRET_KEY) return c.json({ error: "pagos no configurados" }, 503);
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  try {
    const s = await stripe.checkout.sessions.retrieve(id);
    return c.json({
      status: s.status,
      payment_status: s.payment_status,
      email: s.customer_details?.email || null,
    });
  } catch {
    return c.json({ error: "sesión no encontrada" }, 404);
  }
});

app.post("/stripe-webhook", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("STRIPE_WEBHOOK_SECRET vacío — ignorando webhook");
    return c.text("ignored", 200);
  }
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
  const sig = c.req.header("stripe-signature");
  const body = await c.req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return c.text(`Webhook Error: ${err.message}`, 400);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    try {
      // Metadata trae solo [{id, cantidad}]; nombre y precio se resuelven aquí del JSON.
      const carrito = JSON.parse(session.metadata?.carrito || "[]");
      const items = carrito.map((it) => {
        const p = findProducto(it.id);
        return {
          id: it.id,
          nombre: p ? nombreCanonico(p) : String(it.id),
          precio: p ? p.precio : null,
          cantidad: Number(it.cantidad),
        };
      });

      // Dirección de envío: según versión de API viene en collected_information o en shipping_details.
      const ship = session.collected_information?.shipping_details || session.shipping_details || null;
      const envioInfo = {
        zona: session.metadata?.zona || null,
        nombre: ship?.name || session.customer_details?.name || null,
        direccion: ship?.address || null,
        telefono: session.customer_details?.phone || null,
      };

      const stmts = [];
      for (const it of carrito) {
        stmts.push(
          c.env.DB.prepare(
            `UPDATE stock SET cantidad = MAX(0, cantidad - ?) WHERE producto_id = ? AND talla = '_'`
          ).bind(Number(it.cantidad), String(it.id))
        );
      }
      const pedidoId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      stmts.push(
        c.env.DB.prepare(
          `INSERT INTO pedidos (id, stripe_session_id, email, amount_total, currency, items, zona, envio, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`
        ).bind(
          pedidoId,
          session.id,
          session.customer_details?.email || null,
          session.amount_total,
          session.currency,
          JSON.stringify(items),
          envioInfo.zona,
          JSON.stringify(envioInfo)
        )
      );
      // El batch es atómico y stripe_session_id es UNIQUE: si Stripe reenvía el evento,
      // el INSERT falla y el descuento de stock se revierte con él (idempotencia). No "arreglar".
      await c.env.DB.batch(stmts);
      console.log(`[webhook] pedido ${pedidoId} registrado`);

      // Avisos por email. Van DESPUÉS del batch a propósito: si Stripe reenvía el evento,
      // el INSERT revienta por el UNIQUE, saltamos al catch y no se manda un segundo email.
      // La idempotencia de los avisos sale gratis de la que ya había.
      // waitUntil: Stripe recibe su 200 sin esperar a que salgan los correos.
      const pedido = {
        id: pedidoId,
        items,
        envio: envioInfo,
        total: session.amount_total,
        currency: session.currency,
        email: session.customer_details?.email || null,
      };
      enSegundoPlano(
        c,
        Promise.all([notifPedidoNuevo(c.env, pedido), notifPedidoConfirmado(c.env, pedido)])
      );
    } catch (err) {
      console.error("Error procesando checkout.session.completed:", err);
    }
  }

  return c.json({ received: true });
});

// ─── newsletter + contacto ───────────────────────────────
const reEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

app.post("/newsletter", async (c) => {
  const { email } = await c.req.json().catch(() => ({}));
  if (!email || !reEmail.test(String(email))) return c.json({ error: "email inválido" }, 400);
  await c.env.DB.prepare(`INSERT OR IGNORE INTO newsletter (email) VALUES (?)`)
    .bind(String(email).trim().toLowerCase())
    .run();
  return c.json({ ok: true });
});

app.post("/contacto", async (c) => {
  const { texto, email, nombre } = await c.req.json().catch(() => ({}));
  const msg = String(texto || "").trim();
  if (!msg) return c.json({ error: "mensaje vacío" }, 400);
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await c.env.DB.prepare(`INSERT INTO mensajes (id, nombre, email, texto) VALUES (?, ?, ?, ?)`)
    .bind(id, nombre ? String(nombre).slice(0, 200) : null, email ? String(email).slice(0, 200) : null, msg.slice(0, 5000))
    .run();
  // Aviso a la tienda, con replyTo al remitente: se contesta dándole a "Responder".
  enSegundoPlano(c, notifMensajeNuevo(c.env, { id, nombre, email, texto: msg }));
  return c.json({ ok: true });
});

// ─── admin ───────────────────────────────────────────────
const admin = new Hono();

admin.use("*", async (c, next) => {
  const auth = c.req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!c.env.ADMIN_TOKEN || token !== c.env.ADMIN_TOKEN) return c.json({ error: "unauthorized" }, 401);
  await next();
});

admin.get("/historial", async (c) => {
  const limitRaw = Number(c.req.query("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
  const { results } = await c.env.DB.prepare(
    `SELECT id, stripe_session_id, email, amount_total, currency, items, zona, envio, estado,
            created_at AS createdAt
       FROM pedidos ORDER BY created_at DESC LIMIT ?`
  )
    .bind(limit)
    .all();
  return c.json(
    results.map((p) => ({
      ...p,
      items: JSON.parse(p.items || "[]"),
      envio: p.envio ? JSON.parse(p.envio) : null,
    }))
  );
});

const ESTADOS_PEDIDO = ["pendiente", "enviado", "entregado", "cancelado"];

admin.post("/pedido-estado", async (c) => {
  const { id, estado } = await c.req.json().catch(() => ({}));
  if (!id || !ESTADOS_PEDIDO.includes(estado))
    return c.json({ error: `estado debe ser: ${ESTADOS_PEDIDO.join(", ")}` }, 400);
  const r = await c.env.DB.prepare(`UPDATE pedidos SET estado = ? WHERE id = ?`)
    .bind(estado, String(id))
    .run();
  if (!r.meta.changes) return c.json({ error: "pedido no encontrado" }, 404);

  // Al pasar a "enviado", avisamos al cliente. El UPDATE no devuelve la fila, así que
  // la leemos (solo en este caso). items/envio vienen como TEXT: notify.js los parsea.
  if (estado === "enviado") {
    const p = await c.env.DB.prepare(`SELECT email, items, envio FROM pedidos WHERE id = ?`)
      .bind(String(id))
      .first();
    if (p?.email) enSegundoPlano(c, notifPedidoEnviado(c.env, { id: String(id), ...p }));
  }

  return c.json({ ok: true });
});

admin.get("/newsletter", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT email, created_at AS createdAt FROM newsletter ORDER BY created_at DESC LIMIT 1000`
  ).all();
  return c.json(results);
});

admin.get("/mensajes", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, nombre, email, texto, created_at AS createdAt FROM mensajes ORDER BY created_at DESC LIMIT 500`
  ).all();
  return c.json(results);
});

admin.post("/stock-bulk", async (c) => {
  const { productos: updates = [] } = await c.req.json().catch(() => ({}));
  if (!Array.isArray(updates)) return c.json({ error: "productos debe ser array" }, 400);
  const stmts = [];
  for (const u of updates) {
    if (!u?.id || !u?.stockByTalla) continue;
    for (const [talla, cantidad] of Object.entries(u.stockByTalla)) {
      stmts.push(
        c.env.DB.prepare(
          `INSERT INTO stock (producto_id, talla, cantidad) VALUES (?, ?, ?)
           ON CONFLICT (producto_id, talla) DO UPDATE SET cantidad = excluded.cantidad`
        ).bind(String(u.id), String(talla), Math.max(0, Number(cantidad) || 0))
      );
    }
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ updated: updates.length });
});

app.route("/admin", admin);

// El Worker: Hono atiende /api/*; los assets de public/ los sirve Cloudflare automáticamente.
export default app;
