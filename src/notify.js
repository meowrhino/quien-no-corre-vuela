/**
 * src/notify.js — avisos por email de la tienda. SOLO backend (el front no importa esto).
 *
 * Cuatro avisos:
 *   notifPedidoNuevo       → a la TIENDA,  cuando entra un pedido pagado
 *   notifPedidoConfirmado  → al CLIENTE,   cuando entra un pedido pagado
 *   notifMensajeNuevo      → a la TIENDA,  cuando alguien escribe por /contacto
 *   notifPedidoEnviado     → al CLIENTE,   cuando el admin marca el pedido como "enviado"
 *
 * Dos transportes; se elige solo según lo que esté configurado:
 *   1. env.EMAIL           → binding `send_email` de Cloudflare (sin API key, sin dependencias)
 *   2. env.RESEND_API_KEY  → Resend por HTTP (alternativa si no quieres tocar el DNS)
 *   3. ninguno             → no-op: se loguea y ya. La tienda funciona exactamente igual.
 *
 * Vars (wrangler.toml — NO son secretos, se pueden commitear):
 *   EMAIL_FROM       remitente, p.ej. "noreply@midominio.com". VACÍO = todos los avisos apagados.
 *   EMAIL_TIENDA     destinatario interno. Varios separados por coma. Vacío = sin avisos internos.
 *   EMAIL_RESPUESTA  (opcional) a dónde responde el cliente si contesta al noreply.
 *                    Si está vacío se usa EMAIL_TIENDA.
 *   TIENDA_NOMBRE    nombre que sale como remitente y en los asuntos.
 *
 * REGLA DURA: nada de aquí lanza NUNCA. Un fallo de email no puede tumbar el webhook de
 * Stripe ni impedir que se guarde un mensaje de contacto. Todo devuelve true/false.
 *
 * Qué es gratis y qué no (ver README, sección "Avisos por email"):
 *   - Avisos a la TIENDA: gratis en plan free si el destinatario está verificado en tu cuenta.
 *   - Avisos al CLIENTE: hace falta Workers Paid + dominio dado de alta en Email Sending
 *     (o una clave de Resend). Sin eso fallan solos y se loguean; el resto sigue funcionando.
 */

// ─── utilidades ──────────────────────────────────────────
const listaEmails = (v) =>
  String(v || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const money = (valor, moneda = "EUR") =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: String(moneda || "EUR").toUpperCase(),
  }).format(Number(valor) || 0);

const escapeHtml = (str) =>
  String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Los pedidos guardan items/envio como TEXT en D1. Acepta el objeto ya parseado o el string. */
const asJson = (v, porDefecto) => {
  if (typeof v !== "string") return v ?? porDefecto;
  try {
    return JSON.parse(v);
  } catch {
    return porDefecto;
  }
};

// ─── envío ───────────────────────────────────────────────
/**
 * Manda un email. Devuelve true/false; NUNCA lanza.
 * El HTML se deriva del texto plano metiéndolo en un <pre>: así no hay dos plantillas
 * que mantener sincronizadas y se lee bien en cualquier cliente de correo.
 */
async function enviar(env, { to, subject, texto, replyTo }) {
  const from = String(env.EMAIL_FROM || "").trim();
  const destinos = Array.isArray(to) ? to.filter(Boolean) : listaEmails(to);

  if (!from || !destinos.length) {
    console.log(`[notify] sin configurar (EMAIL_FROM o destinatario vacío) — no se envía: ${subject}`);
    return false;
  }

  const nombre = env.TIENDA_NOMBRE || "Tienda";
  const html = `<pre style="font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap">${escapeHtml(texto)}</pre>`;

  try {
    if (env.EMAIL) {
      // Binding send_email de Cloudflare.
      await env.EMAIL.send({
        to: destinos,
        from: { email: from, name: nombre },
        replyTo: replyTo || undefined,
        subject,
        text: texto,
        html,
      });
    } else if (env.RESEND_API_KEY) {
      // Resend por HTTP. Ojo: aquí el campo es reply_to (snake_case), no replyTo.
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: `${nombre} <${from}>`,
          to: destinos,
          reply_to: replyTo || undefined,
          subject,
          text: texto,
          html,
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    } else {
      console.log(`[notify] sin transporte (ni binding EMAIL ni RESEND_API_KEY) — no se envía: ${subject}`);
      return false;
    }
    console.log(`[notify] enviado "${subject}" → ${destinos.join(", ")}`);
    return true;
  } catch (err) {
    // A propósito no re-lanzamos: el pedido ya está guardado y eso es lo que importa.
    console.error(`[notify] fallo enviando "${subject}":`, err?.code || "", err?.message || err);
    return false;
  }
}

// ─── trozos de texto reutilizables ───────────────────────
function lineasPedido(pedido) {
  const items = asJson(pedido.items, []) || [];
  if (!items.length) return "  (sin detalle)";
  return items
    .map((it) => {
      const talla = it.talla && it.talla !== "_" ? ` · ${it.talla}` : "";
      const importe = it.precio != null ? `   ${money(Number(it.precio) * Number(it.cantidad))}` : "";
      return `  ${it.cantidad} × ${it.nombre}${talla}${importe}`;
    })
    .join("\n");
}

function bloqueEnvio(envioRaw) {
  const envio = asJson(envioRaw, null);
  if (!envio) return "";
  const d = envio.direccion || null;
  const partes = [
    envio.zona ? `Zona:      ${envio.zona}` : "",
    envio.nombre ? `Nombre:    ${envio.nombre}` : "",
    d ? `Dirección: ${[d.line1, d.line2, d.postal_code, d.city, d.state, d.country].filter(Boolean).join(", ")}` : "",
    envio.telefono ? `Teléfono:  ${envio.telefono}` : "",
  ].filter(Boolean);
  return partes.length ? `\n\nENVÍO\n${partes.join("\n")}` : "";
}

const responderA = (env) => env.EMAIL_RESPUESTA || env.EMAIL_TIENDA || undefined;

/**
 * Lanza un aviso sin hacer esperar a la respuesta HTTP.
 * En Workers `c.executionCtx.waitUntil` mantiene vivo el isolate hasta que el email sale,
 * pero fuera de Workers (tests, otro runtime) `executionCtx` no existe: ahí el try/catch
 * evita que un aviso tumbe la petición. Nunca lanza.
 */
export function enSegundoPlano(c, promesa) {
  try {
    c.executionCtx.waitUntil(promesa);
  } catch {
    // Sin executionCtx: la promesa corre igual, solo que sin garantía de completarse.
  }
}

// ─── los cuatro avisos ───────────────────────────────────

/** Pedido nuevo → a la tienda. Con todo lo necesario para prepararlo sin abrir el admin. */
export function notifPedidoNuevo(env, pedido) {
  const total = money((pedido.total || 0) / 100, pedido.currency);
  const texto = `Ha entrado un pedido.

Referencia: ${pedido.id}
Cliente:    ${pedido.email || "—"}

${lineasPedido(pedido)}

TOTAL: ${total}${bloqueEnvio(pedido.envio)}

Gestionarlo en /admin/tickets.html`;

  return enviar(env, {
    to: env.EMAIL_TIENDA,
    replyTo: pedido.email || undefined,
    subject: `Pedido nuevo · ${total}`,
    texto,
  });
}

/** Pedido nuevo → al cliente. Complementa (no sustituye) al recibo de Stripe. */
export function notifPedidoConfirmado(env, pedido) {
  if (!pedido.email) return Promise.resolve(false);
  const tienda = env.TIENDA_NOMBRE || "la tienda";
  const texto = `¡Gracias por tu pedido!

Referencia: ${pedido.id}

${lineasPedido(pedido)}

TOTAL: ${money((pedido.total || 0) / 100, pedido.currency)}${bloqueEnvio(pedido.envio)}

Lo preparamos y te avisamos por email en cuanto salga.
Si algo no cuadra, responde a este correo.

— ${tienda}`;

  return enviar(env, {
    to: pedido.email,
    replyTo: responderA(env),
    subject: `Tu pedido en ${tienda} · ${pedido.id}`,
    texto,
  });
}

/** Mensaje de contacto → a la tienda. Con replyTo puesto: se contesta dándole a "Responder". */
export function notifMensajeNuevo(env, mensaje) {
  const texto = `Nuevo mensaje desde el formulario de contacto.

De:    ${mensaje.nombre || "—"}
Email: ${mensaje.email || "—"}

${mensaje.texto}

Verlo en /admin/mensajes.html`;

  return enviar(env, {
    to: env.EMAIL_TIENDA,
    replyTo: mensaje.email || undefined,
    subject: `Mensaje de contacto${mensaje.nombre ? ` de ${mensaje.nombre}` : ""}`,
    texto,
  });
}

/** Pedido marcado como "enviado" en el admin → al cliente. */
export function notifPedidoEnviado(env, pedido) {
  if (!pedido.email) return Promise.resolve(false);
  const tienda = env.TIENDA_NOMBRE || "la tienda";
  const texto = `Tu pedido ya está en camino.

Referencia: ${pedido.id}

${lineasPedido(pedido)}${bloqueEnvio(pedido.envio)}

Gracias por comprar en ${tienda}.`;

  return enviar(env, {
    to: pedido.email,
    replyTo: responderA(env),
    subject: `Tu pedido va en camino · ${pedido.id}`,
    texto,
  });
}
