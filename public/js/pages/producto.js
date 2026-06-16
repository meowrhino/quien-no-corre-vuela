/**
 * pages/producto.js — ficha de producto (?id=XXX).
 * Izq: visor de imágenes con < >. Der: ficha técnica + añadir al carrito + descripción.
 */
import { mountLayout } from "../core/layout.js";
import { I18N } from "../core/i18n.js";
import { fetchProducto, escapeHtml, formatPrice, stockTotal } from "../core/data.js";
import { addToCart } from "../core/cart.js";
import { tituloHTML } from "../core/ui.js";

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
      ${multi ? `<div class="galeria-dots">${p.imgs.map((_, i) => `<span class="${i === idx ? "on" : ""}" data-dot="${i}"></span>`).join("")}</div>` : ""}
    </div>`;
}

function infoHTML() {
  const agotado = p.activo !== false && stockTotal(p) <= 0;
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
    root.querySelectorAll("[data-dot]").forEach((d, i) => d.classList.toggle("on", i === idx));
  };
  root.querySelector("[data-prev]")?.addEventListener("click", () => go(idx - 1));
  root.querySelector("[data-next]")?.addEventListener("click", () => go(idx + 1));
  root.querySelectorAll("[data-dot]").forEach((d) =>
    d.addEventListener("click", () => go(Number(d.dataset.dot)))
  );

  root.querySelector("[data-add]")?.addEventListener("click", (e) => {
    addToCart({ id: p.id, titulo: p.titulo, autor: p.autor, precio: p.precio, peso: p.peso || 0, img: p.imgs[0] || "" });
    const btn = e.currentTarget;
    const prev = btn.textContent;
    btn.textContent = I18N.s("product.added");
    setTimeout(() => (btn.textContent = prev), 1200);
  });
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
