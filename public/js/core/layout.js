/**
 * core/layout.js — cabecera y menú compartidos.
 *
 * mountLayout() inyecta al principio del <body>:
 *   - Cabecera: [menú] (izq, esquina)  ·  logo (centro)  ·  carrito (derecha)
 *   - Menú lateral (drawer): navegación + selector de idioma al pie.
 * Aplica i18n, conecta los eventos y pinta el badge del carrito. Llamar una vez por página.
 */
import { CONFIG } from "./config.js";
import { I18N } from "./i18n.js";
import { renderCartBadge } from "./cart.js";

const NAV = [
  { href: "index.html", key: "nav.tienda" },
  { href: "about.html", key: "nav.nosotras" },
  { href: "calendario.html", key: "nav.calendario" },
  { href: "newsletter.html", key: "nav.newsletter" },
  { href: "contacto.html", key: "nav.contacto" },
  { href: "autores.html", key: "nav.autoras" },
];

function build() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <header class="qnc-header">
      <button class="btn-menu" data-menu-open type="button"><span data-i18n="menu">menú</span></button>
      <a class="hdr-logo" href="index.html" aria-label="${CONFIG.TIENDA_NOMBRE}">
        <img src="img/logo.webp" alt="${CONFIG.TIENDA_NOMBRE}" />
      </a>
      <a class="hdr-cart" href="checkout.html" aria-label="carrito">
        <img src="img/iconos/carro.webp" alt="" />
        <span class="cart-badge" data-cart-count></span>
      </a>
    </header>

    <nav class="qnc-menu" data-menu aria-hidden="true">
      <button class="menu-close" data-menu-close type="button" aria-label="cerrar">×</button>
      <ul>
        ${NAV.map((n) => `<li><a href="${n.href}" data-i18n="${n.key}"></a></li>`).join("")}
      </ul>
      <div class="menu-langs" data-langs>
        ${I18N.LANGS.map((l) => `<button type="button" data-lang="${l}" class="${l === I18N.lang ? "on" : ""}">${I18N.LABELS[l]}</button>`).join("")}
      </div>
    </nav>
    <div class="menu-overlay" data-menu-overlay></div>
  `;
  const here = location.pathname.split("/").pop() || "index.html";
  wrap.querySelectorAll(".qnc-menu a").forEach((a) => {
    if (a.getAttribute("href") === here) a.classList.add("is-active");
  });
  Array.from(wrap.children).reverse().forEach((el) => document.body.prepend(el));
}

/** Cambia de idioma con un fundido suave del contenido. */
function setLangFade(l) {
  if (l === I18N.lang) return;
  const main = document.querySelector("main");
  if (!main) return I18N.set(l);
  main.classList.add("lang-fade");
  setTimeout(() => {
    I18N.set(l);
    main.classList.remove("lang-fade");
  }, 220);
}

function wire() {
  const menu = document.querySelector("[data-menu]");
  const overlay = document.querySelector("[data-menu-overlay]");
  const open = () => { document.body.classList.add("menu-open"); menu?.setAttribute("aria-hidden", "false"); };
  const close = () => { document.body.classList.remove("menu-open"); menu?.setAttribute("aria-hidden", "true"); };

  document.querySelector("[data-menu-open]")?.addEventListener("click", open);
  document.querySelector("[data-menu-close]")?.addEventListener("click", close);
  overlay?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  document.querySelectorAll("[data-langs] [data-lang]").forEach((b) =>
    b.addEventListener("click", () => setLangFade(b.dataset.lang))
  );
  document.addEventListener("qnc:lang", () => {
    document.querySelectorAll("[data-langs] [data-lang]").forEach((b) =>
      b.classList.toggle("on", b.dataset.lang === I18N.lang)
    );
  });
}

export function mountLayout() {
  build();
  I18N.apply();
  wire();
  renderCartBadge();
}
