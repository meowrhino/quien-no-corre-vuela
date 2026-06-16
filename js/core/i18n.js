/**
 * core/i18n.js — internacionalización (ES / CA / EN).
 *
 *  - Idioma actual en localStorage('qnc.lang'), por defecto 'es'.
 *  - I18N.t(obj)  → traduce un campo de datos {es,ca,en} (o string/array) con fallback a es.
 *  - I18N.s(key)  → textos fijos de la interfaz (ver STRINGS).
 *  - I18N.cycle() → rota ES→CA→EN, repinta los [data-i18n] y emite el evento 'qnc:lang'.
 *
 * Las páginas escuchan 'qnc:lang' para re-renderizar su contenido dinámico sin recargar.
 */

const LANGS = ["es", "ca", "en"];
const LABELS = { es: "ES", ca: "CA", en: "EN" };
const KEY = "qnc.lang";

function stored() {
  const v = localStorage.getItem(KEY);
  return LANGS.includes(v) ? v : "es";
}
let lang = stored();

// ─── textos fijos de la interfaz ─────────────────────────
const STRINGS = {
  "menu": { es: "menú", ca: "menú", en: "menu" },
  "idioma": { es: "idioma", ca: "idioma", en: "language" },
  "nav.tienda": { es: "tienda", ca: "botiga", en: "shop" },
  "nav.nosotras": { es: "nosotras", ca: "nosaltres", en: "about" },
  "nav.calendario": { es: "calendario", ca: "calendari", en: "calendar" },
  "nav.newsletter": { es: "newsletter", ca: "newsletter", en: "newsletter" },
  "nav.contacto": { es: "contacto", ca: "contacte", en: "contact" },
  "nav.autoras": { es: "autoras", ca: "autores", en: "authors" },
  "cart.title": { es: "carrito", ca: "cistella", en: "cart" },
  "cart.empty": { es: "El carrito está vacío.", ca: "La cistella és buida.", en: "Your cart is empty." },
  "cart.subtotal": { es: "Subtotal", ca: "Subtotal", en: "Subtotal" },
  "cart.shipping": { es: "Envío", ca: "Enviament", en: "Shipping" },
  "cart.total": { es: "Total", ca: "Total", en: "Total" },
  "cart.zone": { es: "Zona de envío", ca: "Zona d'enviament", en: "Shipping zone" },
  "cart.weight": { es: "Peso total", ca: "Pes total", en: "Total weight" },
  "cart.pay": { es: "pagar", ca: "pagar", en: "checkout" },
  "cart.continue": { es: "seguir comprando", ca: "seguir comprant", en: "keep shopping" },
  "product.add": { es: "añadir al carrito", ca: "afegir a la cistella", en: "add to cart" },
  "product.added": { es: "Añadido al carrito", ca: "Afegit a la cistella", en: "Added to cart" },
  "product.soldout": { es: "agotado", ca: "exhaurit", en: "sold out" },
  "product.soon": { es: "próximamente", ca: "pròximament", en: "coming soon" },
  "ficha.editorial": { es: "Editorial", ca: "Editorial", en: "Publisher" },
  "ficha.autor": { es: "Autora", ca: "Autora", en: "Author" },
  "ficha.anio": { es: "Publicación", ca: "Publicació", en: "Release" },
  "ficha.edicion": { es: "Edición", ca: "Edició", en: "Edition" },
  "ficha.encuadernacion": { es: "Encuadernación", ca: "Enquadernació", en: "Binding" },
  "ficha.paginas": { es: "Páginas", ca: "Pàgines", en: "Pages" },
  "ficha.medidas": { es: "Medidas", ca: "Mides", en: "Size" },
  "news.title": { es: "apúntate a nuestra newsletter!!!", ca: "apunta't a la nostra newsletter!!!", en: "join our newsletter!!!" },
  "news.placeholder": { es: "tu email", ca: "el teu email", en: "your email" },
  "news.send": { es: "enviar", ca: "enviar", en: "send" },
  "news.ok": { es: "¡gracias! te has apuntado.", ca: "gràcies! t'has apuntat.", en: "thanks! you're in." },
  "contact.title": { es: "dinos cosas!!", ca: "digues-nos coses!!", en: "tell us things!!" },
  "contact.placeholder": { es: "tu mensaje", ca: "el teu missatge", en: "your message" },
  "contact.email": { es: "tu email (opcional)", ca: "el teu email (opcional)", en: "your email (optional)" },
  "contact.send": { es: "enviar", ca: "enviar", en: "send" },
  "contact.ok": { es: "¡gracias! lo hemos recibido.", ca: "gràcies! ho hem rebut.", en: "thanks! we got it." },
  "cal.now": { es: "ahora en España", ca: "ara a Espanya", en: "now in Spain" },
  "cal.past": { es: "pasado", ca: "passat", en: "past" },
  "cal.upcoming": { es: "próximo", ca: "pròxim", en: "upcoming" },
  "loading": { es: "Cargando…", ca: "Carregant…", en: "Loading…" },
  "error.load": { es: "Error al cargar. Inténtalo de nuevo.", ca: "Error en carregar. Torna-ho a provar.", en: "Loading error. Please try again." },
  "error.generic": { es: "Algo ha fallado.", ca: "Alguna cosa ha fallat.", en: "Something went wrong." },
};

// ─── API ─────────────────────────────────────────────────
function t(obj) {
  if (obj == null) return "";
  if (Array.isArray(obj)) return obj.join("\n");
  if (typeof obj === "object") return obj[lang] ?? obj.es ?? Object.values(obj)[0] ?? "";
  return String(obj);
}

function s(key) {
  const o = STRINGS[key];
  return o ? o[lang] ?? o.es : key;
}

/** Rellena [data-i18n] (textContent) y [data-i18n-ph] (placeholder) de un ámbito. */
function apply(root) {
  const scope = root || document;
  scope.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = s(el.getAttribute("data-i18n"));
  });
  scope.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    el.setAttribute("placeholder", s(el.getAttribute("data-i18n-ph")));
  });
  document.documentElement.lang = lang;
}

function set(l) {
  if (!LANGS.includes(l) || l === lang) return;
  lang = l;
  localStorage.setItem(KEY, l);
  apply();
  document.dispatchEvent(new CustomEvent("qnc:lang", { detail: { lang } }));
}

function cycle() {
  set(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]);
}

export const I18N = {
  get lang() { return lang; },
  LANGS,
  LABELS,
  STRINGS,
  t,
  s,
  set,
  cycle,
  apply,
  label() { return LABELS[lang]; },
};
