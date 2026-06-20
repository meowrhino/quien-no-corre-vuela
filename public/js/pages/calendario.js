/**
 * pages/calendario.js — línea temporal de ferias/eventos.
 *
 *  - Eventos en scroll horizontal, ordenados viejo (izq) → nuevo (der).
 *  - Marcador FIJO en el centro (︿ + día + hora): siempre centrado. La hora sólo aparece
 *    cuando el centro coincide con "hoy".
 *  - Al cargar, se centra el momento ACTUAL (hora de España, Europe/Madrid, sin permisos).
 *  - Al desplazarte, el día del marcador cambia al del evento que tengas centrado.
 */
import { mountLayout } from "../core/layout.js";
import { I18N } from "../core/i18n.js";
import { fetchEventos, escapeHtml } from "../core/data.js";

mountLayout();

const TZ = "Europe/Madrid";
const track = document.querySelector("[data-cal-track]");
const marker = document.querySelector("[data-marker]");
const mDate = document.querySelector("[data-marker-date]");

let eventos = [];
const LOCALE = { es: "es-ES", ca: "ca-ES", en: "en-GB" };
const locale = () => LOCALE[I18N.lang] || "es-ES";

/** Hoy en España como "YYYY-MM-DD". */
const hoyISO = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const ddmm = (iso) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const parseDia = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

function fmtFechaLarga(ev) {
  const opts = { day: "numeric", month: "long", year: "numeric" };
  const ini = parseDia(ev.fechaInicio);
  if (ev.fechaFin && ev.fechaFin !== ev.fechaInicio) {
    const fin = parseDia(ev.fechaFin);
    const same = ini.getMonth() === fin.getMonth() && ini.getFullYear() === fin.getFullYear();
    if (same) return `${ini.getDate()}–${fin.getDate()} ${new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric" }).format(ini)}`;
    return `${new Intl.DateTimeFormat(locale(), opts).format(ini)} – ${new Intl.DateTimeFormat(locale(), opts).format(fin)}`;
  }
  return new Intl.DateTimeFormat(locale(), opts).format(ini);
}

function cardHTML(ev) {
  const cartel = ev.cartel
    ? `<div class="evento-cartel"><img src="${ev.cartel}" alt="${escapeHtml(ev.titulo)}"></div>`
    : `<div class="evento-cartel evento-cartel--vacio"></div>`;
  return `
    <article class="evento" data-snap data-fecha="${ddmm(ev.fechaInicio)}" data-iso="${ev.fechaInicio}">
      ${cartel}
      <div class="evento-fecha">${fmtFechaLarga(ev)}</div>
      <h3 class="evento-titulo">${escapeHtml(ev.titulo)}</h3>
      <div class="evento-tipo">${escapeHtml(I18N.t(ev.tipo))}</div>
      <div class="evento-lugar">${escapeHtml(ev.lugar)}</div>
    </article>`;
}

const nowSlotHTML = (hoy) =>
  `<div class="cal-now" data-snap data-now-slot data-fecha="${ddmm(hoy)}" data-iso="${hoy}"></div>`;

function render() {
  if (!track) return;
  const hoy = hoyISO();
  const ordenados = [...eventos].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));

  let html = "";
  let nowDone = false;
  for (const ev of ordenados) {
    if (!nowDone && (ev.fechaFin || ev.fechaInicio) >= hoy) {
      html += nowSlotHTML(hoy);
      nowDone = true;
    }
    html += cardHTML(ev);
  }
  if (!nowDone) html += nowSlotHTML(hoy); // hoy es posterior a todos → a la derecha
  track.innerHTML = html;

  // Centra "hoy". Como los carteles no reservan alto hasta cargar, recentramos cuando
  // van cargando (si no, el scroll se calcula sobre un layout colapsado).
  const centrarHoy = () => {
    track.querySelector("[data-now-slot]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "instant" });
    updateMarker();
  };
  requestAnimationFrame(centrarHoy);
  track.querySelectorAll(".evento-cartel img").forEach((im) => {
    if (!im.complete) im.addEventListener("load", centrarHoy, { once: true });
  });
}

function nearestToCenter() {
  const r = track.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  let best = null, bestD = Infinity;
  track.querySelectorAll("[data-snap]").forEach((el) => {
    const er = el.getBoundingClientRect();
    const d = Math.abs(er.left + er.width / 2 - cx);
    if (d < bestD) { bestD = d; best = el; }
  });
  return best;
}

function updateMarker() {
  const el = nearestToCenter();
  if (!el || !mDate) return;
  track.querySelectorAll(".is-center").forEach((e) => e.classList.remove("is-center"));
  el.classList.add("is-center");
  mDate.textContent = el.dataset.fecha;
  marker.hidden = false;
}

let ticking = false;
track?.addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { updateMarker(); ticking = false; });
});

// Flechas del marcador: saltan al evento anterior/siguiente (‹ más antiguo, › más nuevo).
function scrollToAdjacent(dir) {
  if (!track) return;
  const snaps = [...track.querySelectorAll("[data-snap]")];
  const i = snaps.indexOf(nearestToCenter());
  snaps[i + dir]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
}
document.querySelector("[data-cal-prev]")?.addEventListener("click", () => scrollToAdjacent(-1));
document.querySelector("[data-cal-next]")?.addEventListener("click", () => scrollToAdjacent(1));

async function init() {
  try {
    eventos = await fetchEventos();
  } catch (err) {
    console.error("calendario", err);
    if (track) track.innerHTML = `<p class="estado">${I18N.s("error.load")}</p>`;
    return;
  }
  render();
}

init();
document.addEventListener("qnc:lang", render);
