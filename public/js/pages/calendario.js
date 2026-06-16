/**
 * pages/calendario.js — línea temporal de ferias/eventos.
 *
 *  - Eventos ordenados ascendente (viejo → nuevo): viejo a la izquierda, nuevo a la derecha.
 *  - Pasados con opacidad reducida (pero clicables); próximos/actuales a plena opacidad.
 *  - Un divisor "ahora" se inserta entre el último pasado y el primer próximo.
 *  - Chip inferior con el día y la hora ACTUAL en España (Europe/Madrid), sin pedir permisos:
 *    es solo Intl.DateTimeFormat con timeZone fija.
 */
import { mountLayout } from "../core/layout.js";
import { I18N } from "../core/i18n.js";
import { fetchEventos, escapeHtml } from "../core/data.js";

mountLayout();

const TZ = "Europe/Madrid";
const track = document.querySelector("[data-cal-track]");
const chip = document.querySelector("[data-now]");
const nowTime = document.querySelector("[data-now-time]");
const nowDot = document.querySelector("[data-now-dot]");

let eventos = [];

const LOCALE = { es: "es-ES", ca: "ca-ES", en: "en-GB" };
const locale = () => LOCALE[I18N.lang] || "es-ES";

/** Fecha de hoy en España como "YYYY-MM-DD" (para comparar a nivel de día). */
function hoyMadrid() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** "YYYY-MM-DD" → Date local (evita el desfase de día por UTC). */
function parseDia(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmtFecha(ev) {
  const opts = { day: "numeric", month: "long", year: "numeric" };
  const ini = parseDia(ev.fechaInicio);
  const f1 = new Intl.DateTimeFormat(locale(), opts).format(ini);
  if (ev.fechaFin && ev.fechaFin !== ev.fechaInicio) {
    const fin = parseDia(ev.fechaFin);
    const sameMonth = ini.getMonth() === fin.getMonth() && ini.getFullYear() === fin.getFullYear();
    const f2 = new Intl.DateTimeFormat(locale(), sameMonth ? { day: "numeric" } : opts).format(fin);
    return sameMonth
      ? `${ini.getDate()}–${f2} ${new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric" }).format(ini)}`
      : `${f1} – ${f2}`;
  }
  return f1;
}

function cardHTML(ev, past) {
  const tipo = escapeHtml(I18N.t(ev.tipo));
  const cartel = ev.cartel
    ? `<div class="evento-cartel"><img src="${ev.cartel}" alt="${escapeHtml(ev.titulo)}" loading="lazy"></div>`
    : `<div class="evento-cartel">${past ? I18N.s("cal.past") : I18N.s("cal.upcoming")}</div>`;
  return `
    <article class="evento ${past ? "is-past" : "is-next"}">
      ${cartel}
      <div class="evento-fecha">${fmtFecha(ev)}</div>
      <h3 class="evento-titulo">${escapeHtml(ev.titulo)}</h3>
      <div class="evento-tipo">${tipo}</div>
      <div class="evento-lugar">${escapeHtml(ev.lugar)}</div>
    </article>`;
}

function render() {
  if (!track) return;
  const hoy = hoyMadrid();
  const ordenados = [...eventos].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));

  let html = "";
  let dividerInserted = false;
  for (const ev of ordenados) {
    const past = (ev.fechaFin || ev.fechaInicio) < hoy;
    if (!past && !dividerInserted) {
      html += `<div class="cal-now-divider" data-now-divider></div>`;
      dividerInserted = true;
    }
    html += cardHTML(ev, past);
  }
  if (!dividerInserted) html += `<div class="cal-now-divider" data-now-divider></div>`;
  track.innerHTML = html || `<p class="estado">${I18N.s("error.load")}</p>`;

  requestAnimationFrame(() => {
    track.querySelector("[data-now-divider]")?.scrollIntoView({ inline: "center", block: "nearest" });
  });
}

function tickNow() {
  if (!chip) return;
  const now = new Date();
  const txt = new Intl.DateTimeFormat(locale(), {
    timeZone: TZ, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  }).format(now);
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, day: "2-digit" }).format(now);
  if (nowTime) nowTime.textContent = txt;
  if (nowDot) nowDot.textContent = dia;
  chip.hidden = false;
}

async function init() {
  try {
    eventos = await fetchEventos();
  } catch (err) {
    console.error("calendario", err);
    if (track) track.innerHTML = `<p class="estado">${I18N.s("error.load")}</p>`;
  }
  render();
  tickNow();
  setInterval(tickNow, 30000);
}

init();
document.addEventListener("qnc:lang", () => { render(); tickNow(); });
