/**
 * pages/producto.js — ficha de producto (?id=XXX).
 * Izq: visor de imágenes con < >. Der: ficha técnica + añadir al carrito + descripción.
 */
import { mountLayout } from "../core/layout.js";
import { I18N } from "../core/i18n.js";
import { fetchProducto, escapeHtml, formatPrice, estaAgotado } from "../core/data.js";
import { addToCart } from "../core/cart.js";
import { tituloHTML, toast } from "../core/ui.js";

mountLayout();

const root = document.querySelector("[data-producto]");
const id = new URLSearchParams(location.search).get("id");
let p = null;
let idx = 0;

function fichaRows() {
  const f = p.ficha || {};
  const rows = [
    ["ficha.editorial", f.editorial],
    ["ficha.autor", p.autor],
    ["ficha.anio", I18N.t(f.anio)],
    ["ficha.edicion", I18N.t(f.edicion)],
    ["ficha.encuadernacion", I18N.t(f.encuadernacion)],
    ["ficha.paginas", f.paginas != null ? String(f.paginas) : ""],
    ["ficha.medidas", f.medidas],
  ];
  return rows
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `<tr><td class="k">${I18N.s(k)}</td><td class="v">${escapeHtml(v)}</td></tr>`)
    .join("");
}

function galeriaHTML() {
  if (!p.imgs.length) {
    return `<div class="galeria"><div class="galeria-stage"><div class="card-img is-empty">${I18N.s("product.soon")}</div></div></div>`;
  }
  const multi = p.imgs.length > 1;
  return `
    <div class="galeria">
      <div class="galeria-stage">
        ${multi ? `<button class="galeria-nav prev" data-prev aria-label="anterior">‹</button>` : ""}
        <img data-stage src="${p.imgs[idx]}" alt="${escapeHtml(p.titulo.join(" "))}" />
        ${multi ? `<button class="galeria-nav next" data-next aria-label="siguiente">›</button>` : ""}
      </div>
      ${multi ? `<div class="galeria-thumbs">${p.imgs
        .map((src, i) => `<button class="${i === idx ? "on" : ""}" data-thumb="${i}" type="button" aria-label="imagen ${i + 1}"><img src="${src}" alt="" loading="lazy"></button>`)
        .join("")}</div>` : ""}
    </div>`;
}

function infoHTML() {
  const agotado = estaAgotado(p);
  const proximamente = p.activo === false;
  let btn;
  if (proximamente) btn = `<button class="btn-add" disabled>${I18N.s("product.soon")}</button>`;
  else if (agotado) btn = `<button class="btn-add" disabled>${I18N.s("product.soldout")}</button>`;
  else btn = `<button class="btn-add" data-add>${I18N.s("product.add")}</button>`;

  return `
    <div class="producto-info">
      <table class="ficha"><tbody>${fichaRows()}</tbody></table>
      ${btn}
      <h1 class="producto-titulo">${tituloHTML(p.titulo)}</h1>
      <div class="producto-meta">
        <span class="autor">${escapeHtml(p.autor)}</span>
        <span class="precio">${formatPrice(p.precio)}</span>
      </div>
      <div class="producto-desc">${escapeHtml(I18N.t(p.descripcion))}</div>
    </div>`;
}

function render() {
  root.innerHTML = galeriaHTML() + infoHTML();
  document.title = `${p.titulo.join(" ")} · Quien no corre, vuela`;

  const stage = root.querySelector("[data-stage]");
  const go = (n) => {
    idx = (n + p.imgs.length) % p.imgs.length;
    stage.src = p.imgs[idx];
    const activa = root.querySelectorAll("[data-thumb]");
    activa.forEach((t, i) => t.classList.toggle("on", i === idx));
    activa[idx]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  root.querySelector("[data-prev]")?.addEventListener("click", () => go(idx - 1));
  root.querySelector("[data-next]")?.addEventListener("click", () => go(idx + 1));
  root.querySelectorAll("[data-thumb]").forEach((t) =>
    t.addEventListener("click", () => go(Number(t.dataset.thumb)))
  );

  // Clic en la imagen → ampliar a pantalla completa (lightbox).
  stage?.addEventListener("click", () => openLightbox(idx));

  root.querySelector("[data-add]")?.addEventListener("click", () => {
    addToCart({ id: p.id, titulo: p.titulo, autor: p.autor, precio: p.precio, peso: p.peso || 0, img: p.imgs[0] || "" });
    toast(I18N.s("product.added"));
  });
}

// ─── lightbox (ampliar imagen) ───────────────────────────
let lbIdx = 0;
function lbSync() {
  const img = document.querySelector(".qnc-lightbox .lb-img");
  if (img) img.src = p.imgs[lbIdx];
}
function lbGo(d) { lbIdx = (lbIdx + d + p.imgs.length) % p.imgs.length; lbSync(); }
function closeLightbox() { document.querySelector(".qnc-lightbox")?.classList.remove("show"); }
function lbKey(e) {
  const ov = document.querySelector(".qnc-lightbox");
  if (!ov || !ov.classList.contains("show")) return;
  if (e.key === "Escape") closeLightbox();
  else if (e.key === "ArrowLeft") lbGo(-1);
  else if (e.key === "ArrowRight") lbGo(1);
}
function openLightbox(startIdx) {
  if (!p?.imgs?.length) return;
  lbIdx = startIdx;
  let ov = document.querySelector(".qnc-lightbox");
  if (!ov) {
    ov = document.createElement("div");
    ov.className = "qnc-lightbox";
    ov.innerHTML = `
      <button class="lb-close" type="button" aria-label="cerrar">×</button>
      <button class="lb-nav prev" type="button" aria-label="anterior">‹</button>
      <img class="lb-img" alt="">
      <button class="lb-nav next" type="button" aria-label="siguiente">›</button>`;
    document.body.appendChild(ov);
    ov.querySelector(".lb-close").addEventListener("click", closeLightbox);
    ov.querySelector(".lb-img").addEventListener("click", closeLightbox);
    ov.addEventListener("click", (e) => { if (e.target === ov) closeLightbox(); });
    ov.querySelector(".lb-nav.prev").addEventListener("click", (e) => { e.stopPropagation(); lbGo(-1); });
    ov.querySelector(".lb-nav.next").addEventListener("click", (e) => { e.stopPropagation(); lbGo(1); });
    document.addEventListener("keydown", lbKey);
  }
  ov.querySelectorAll(".lb-nav").forEach((b) => (b.hidden = p.imgs.length < 2));
  lbSync();
  ov.classList.add("show");
}

async function init() {
  if (!root) return;
  if (!id) { root.innerHTML = `<p class="estado">${I18N.s("error.generic")}</p>`; return; }
  try {
    p = await fetchProducto(id);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<p class="estado">${I18N.s("error.load")}</p>`;
    return;
  }
  if (!p) { root.innerHTML = `<p class="estado">404</p>`; return; }
  render();
  document.addEventListener("qnc:lang", render);
}

init();
