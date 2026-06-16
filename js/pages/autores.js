/**
 * pages/autores.js — grid de autoras (funciona como la tienda).
 * Sin foto de autora, usamos la portada de su primer fanzine.
 */
import { mountLayout } from "../core/layout.js";
import { I18N } from "../core/i18n.js";
import { fetchAutores, fetchProductos, escapeHtml } from "../core/data.js";

mountLayout();

const container = document.querySelector("[data-autores]");
let autores = [];
let productos = [];

function fotoDe(a) {
  if (a.foto) return a.foto;
  const obra = productos.find((p) => p.autorId === a.id && p.imgs[0]);
  return obra ? obra.imgs[0] : "";
}

function render() {
  if (!container) return;
  container.innerHTML = autores
    .map((a) => {
      const foto = fotoDe(a);
      const img = foto
        ? `<div class="card-img"><img src="${foto}" alt="${escapeHtml(a.nombre)}" loading="lazy"></div>`
        : `<div class="card-img is-empty">${escapeHtml(a.nombre)}</div>`;
      return `
        <a class="autor-card" href="autor.html?id=${encodeURIComponent(a.id)}">
          ${img}
          <em class="autor-nombre">${escapeHtml(a.nombre)}</em>
        </a>`;
    })
    .join("");
}

async function init() {
  try {
    [autores, productos] = await Promise.all([fetchAutores(), fetchProductos()]);
  } catch (err) {
    console.error("autores", err);
    if (container) container.innerHTML = `<p class="estado">${I18N.s("error.load")}</p>`;
    return;
  }
  render();
}

init();
document.addEventListener("qnc:lang", render);
