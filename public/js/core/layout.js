/**
 * core/layout.js — cabecera y menú compartidos.
 *
 * mountLayout() inyecta al principio del <body>:
 *   - Cabecera: [menú] [idioma]  ·  logo (centro)  ·  carrito (derecha)
 *   - Menú lateral (drawer) con la navegación.
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
      <div class="hdr-left">
        <button class="btn-menu" data-menu-open type="button"><span data-i18n="menu">menú</span></button>
        <button class="lang-toggle" data-lang-toggle type="button" title="idioma">
          <span class="lang-code">${I18N.label()}</span>
        </button>
      </div>
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
    </nav>
    <div class="menu-overlay" data-menu-overlay></div>
  `;
  const here = location.pathname.split("/").pop() || "index.html";
  wrap.querySelectorAll(".qnc-menu a").forEach((a) => {
    if (a.getAttribute("href") === here) a.classList.add("is-active");
  });
  Array.from(wrap.children).reverse().forEach((el) => document.body.prepend(el));
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

  const toggle = document.querySelector("[data-lang-toggle]");
  // Fundido suave: oculta el contenido, cambia de idioma mientras está invisible, y reaparece.
  toggle?.addEventListener("click", () => {
    const main = document.querySelector("main");
    if (!main) return I18N.cycle();
    main.classList.add("lang-fade");
    setTimeout(() => {
      I18N.cycle();
      main.classList.remove("lang-fade");
    }, 220);
  });
  document.addEventListener("qnc:lang", () => {
    const code = toggle?.querySelector(".lang-code");
    if (code) code.textContent = I18N.label();
  });
}

export function mountLayout() {
  build();
  I18N.apply();
  wire();
  renderCartBadge();
}
