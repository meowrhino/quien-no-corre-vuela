/**
 * core/ui.js — fragmentos de HTML reutilizables entre páginas.
 */
import { I18N } from "./i18n.js";
import { escapeHtml, formatPrice, estaAgotado } from "./data.js";

let toastTimer = null;
/** Muestra un aviso flotante temporal (p.ej. "añadido al carrito"). */
export function toast(msg) {
  let el = document.querySelector(".qnc-toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "qnc-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  // Reinicia la animación aunque ya estuviera visible.
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1600);
}

/** Título (array de líneas) → HTML en cursiva multi-línea. */
export function tituloHTML(titulo) {
  const lineas = Array.isArray(titulo) ? titulo : [titulo];
  return lineas.map((l) => escapeHtml(l)).join("<br>");
}

/** Card de producto para la home, la página de autora, etc. */
export function productoCardHTML(p) {
  const titulo = Array.isArray(p.titulo) ? p.titulo : [p.titulo];
  const imgs = p.imgs || [];
  const cover = imgs[0];
  const agotado = estaAgotado(p);
  const img = cover
    ? `<div class="card-img">
        <img src="${cover}" alt="${escapeHtml(titulo.join(" "))}" loading="lazy">
        ${imgs[1] ? `<img class="card-img-alt" src="${imgs[1]}" alt="" loading="lazy">` : ""}
      </div>`
    : `<div class="card-img is-empty">${I18N.s("product.soon")}</div>`;
  const soldout = `<span class="soldout"><span class="dot" aria-hidden="true"></span><span class="txt">${I18N.s("product.soldout")}</span></span>`;
  return `
    <a class="card${p.activo === false ? " is-soon" : ""}${agotado ? " is-agotado" : ""}" href="producto.html?id=${encodeURIComponent(p.id)}">
      ${img}
      <em class="card-titulo">${tituloHTML(titulo)}</em>
      <div class="card-meta">
        <span class="autor">${escapeHtml(p.autor)}</span>
        <span class="precio">${agotado ? soldout : formatPrice(p.precio)}</span>
      </div>
    </a>`;
}
