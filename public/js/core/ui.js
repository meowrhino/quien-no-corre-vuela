/**
 * core/ui.js — fragmentos de HTML reutilizables entre páginas.
 */
import { I18N } from "./i18n.js";
import { escapeHtml, formatPrice } from "./data.js";

/** Título (array de líneas) → HTML en cursiva multi-línea. */
export function tituloHTML(titulo) {
  const lineas = Array.isArray(titulo) ? titulo : [titulo];
  return lineas.map((l) => escapeHtml(l)).join("<br>");
}

/** Card de producto para la home, la página de autora, etc. */
export function productoCardHTML(p) {
  const titulo = Array.isArray(p.titulo) ? p.titulo : [p.titulo];
  const cover = (p.imgs || [])[0];
  const img = cover
    ? `<div class="card-img"><img src="${cover}" alt="${escapeHtml(titulo.join(" "))}" loading="lazy"></div>`
    : `<div class="card-img is-empty">${I18N.s("product.soon")}</div>`;
  return `
    <a class="card${p.activo === false ? " is-soon" : ""}" href="producto.html?id=${encodeURIComponent(p.id)}">
      ${img}
      <em class="card-titulo">${tituloHTML(titulo)}</em>
      <div class="card-meta">
        <span class="autor">${escapeHtml(p.autor)}</span>
        <span class="precio">${formatPrice(p.precio)}</span>
      </div>
    </a>`;
}
