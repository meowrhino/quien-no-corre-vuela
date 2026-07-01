/**
 * core/data.js — capa de datos (catálogo, autoras, eventos, envíos) + utilidades.
 *
 * Estrategia JAMstack: el catálogo se lee de los JSON estáticos del repo, así la web se
 * previsualiza sin Functions. El stock vivo se pide a /api/stock; si no está disponible,
 * se cae a stockInicial declarado en el propio JSON.
 *
 * Modelo de producto (data/productos.json):
 *   { id, titulo:[líneas], autor, autorId, precio, peso(g), imgs:[...], ficha:{...},
 *     descripcion:{es,ca,en}, stockInicial, activo }
 */
import { CONFIG } from "./config.js";

// ─── utilidades ──────────────────────────────────────────
export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

export function formatPrice(eur) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: CONFIG.MONEDA || "EUR",
  }).format(Number(eur) || 0);
}

/** stockInicial: número → {_: n}; objeto {talla: n} → normalizado. */
export function normalizeStockInicial(si) {
  if (typeof si === "number" && Number.isFinite(si)) return { _: Math.max(0, si) };
  if (si && typeof si === "object") {
    const out = {};
    for (const [k, v] of Object.entries(si)) out[k] = Math.max(0, Number(v) || 0);
    return out;
  }
  return {};
}

export function stockTotal(p) {
  return Object.values(p.stockByTalla || {}).reduce((n, v) => n + Number(v || 0), 0);
}

/**
 * Un producto está agotado si está activo pero marcado `agotado` o sin stock vivo.
 * Los "próximamente" (activo:false) no cuentan como agotados. Criterio único del front;
 * el servidor recalcula por su cuenta al crear la sesión de pago.
 */
export function estaAgotado(p) {
  return p.activo !== false && (p.agotado === true || stockTotal(p) <= 0);
}

/** Precio de envío según zona (tramos por peso en gramos) y peso total. */
export function precioEnvio(zona, gramos) {
  if (!zona || !Array.isArray(zona.tramos)) return 0;
  const tramos = [...zona.tramos].sort((a, b) => a.hasta - b.hasta);
  for (const tr of tramos) if (gramos <= tr.hasta) return Number(tr.precio) || 0;
  return Number(tramos[tramos.length - 1]?.precio) || 0;
}

// ─── catálogo ────────────────────────────────────────────
async function getJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${path} no disponible (HTTP ${res.status})`);
  return res.json();
}

/** Intenta enriquecer con el stock vivo de la API; si no hay Functions, devuelve null. */
async function stockVivo() {
  try {
    const res = await fetch(`${CONFIG.API_BASE}/stock`);
    if (res.ok) return await res.json();
  } catch {
    /* preview estático sin Functions */
  }
  return null;
}

/** Normaliza un producto crudo del JSON y le inyecta el stock disponible. */
function hydrate(raw, stock) {
  return {
    ...raw,
    titulo: Array.isArray(raw.titulo) ? raw.titulo : [raw.titulo],
    imgs: Array.isArray(raw.imgs) ? raw.imgs : raw.img ? [raw.img] : [],
    stockByTalla: (stock && stock[raw.id]) || normalizeStockInicial(raw.stockInicial),
  };
}

export async function fetchProductos() {
  const [catalogo, stock] = await Promise.all([getJSON("data/productos.json"), stockVivo()]);
  return catalogo.filter((p) => p.activo !== false).map((p) => hydrate(p, stock));
}

/** Un producto por id (incluye inactivos, para mostrar "próximamente"). */
export async function fetchProducto(id) {
  const [catalogo, stock] = await Promise.all([getJSON("data/productos.json"), stockVivo()]);
  const raw = catalogo.find((p) => String(p.id) === String(id));
  return raw ? hydrate(raw, stock) : null;
}

export const fetchEnvios = () => getJSON("data/envios.json");
export const fetchAutores = () => getJSON("data/autores.json");
export const fetchEventos = () => getJSON("data/eventos.json");

/** Catálogo crudo sin enriquecer (para páginas que solo necesitan listar). */
export const fetchCatalogoRaw = () => getJSON("data/productos.json");
