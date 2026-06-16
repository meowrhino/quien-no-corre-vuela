/**
 * pages/autor.js — detalle de autora (retrato + bio) + sus fanzines (?id=XXX).
 */
import { mountLayout } from "../core/layout.js";
import { I18N } from "../core/i18n.js";
import { fetchAutores, fetchCatalogoRaw, escapeHtml } from "../core/data.js";
import { productoCardHTML } from "../core/ui.js";

mountLayout();

const head = document.querySelector("[data-autor]");
const grid = document.querySelector("[data-obras]");
const id = new URLSearchParams(location.search).get("id");
let autor = null;
let obras = [];

function foto() {
  if (autor.foto) return autor.foto;
  const obra = obras.find((p) => p.imgs[0]);
  return obra ? obra.imgs[0] : "";
}

function render() {
  const f = foto();
  head.innerHTML = `
    <div class="info-foto">${f ? `<img src="${f}" alt="${escapeHtml(autor.nombre)}">` : ""}</div>
    <div class="info-texto">
      <p class="lead">${escapeHtml(autor.nombre)}</p>
      <p>${escapeHtml(I18N.t(autor.bio))}</p>
    </div>`;
  grid.innerHTML = obras.map(productoCardHTML).join("");
  document.title = `${autor.nombre} · Quien no corre, vuela`;
}

async function init() {
  if (!head) return;
  if (!id) { head.innerHTML = `<p class="estado">${I18N.s("error.generic")}</p>`; return; }
  try {
    const [autores, catalogo] = await Promise.all([fetchAutores(), fetchCatalogoRaw()]);
    autor = autores.find((a) => a.id === id);
    obras = catalogo
      .filter((p) => p.autorId === id)
      .map((p) => ({ ...p, titulo: Array.isArray(p.titulo) ? p.titulo : [p.titulo], imgs: Array.isArray(p.imgs) ? p.imgs : [] }));
  } catch (err) {
    console.error("autor", err);
    head.innerHTML = `<p class="estado">${I18N.s("error.load")}</p>`;
    return;
  }
  if (!autor) { head.innerHTML = `<p class="estado">404</p>`; return; }
  render();
  document.addEventListener("qnc:lang", render);
}

init();
