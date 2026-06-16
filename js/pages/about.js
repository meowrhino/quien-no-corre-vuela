/**
 * pages/about.js — statement de la editorial (trilingüe).
 * Traducciones CA/EN: borrador a revisar por el cliente.
 */
import { mountLayout } from "../core/layout.js";
import { I18N } from "../core/i18n.js";
import { escapeHtml } from "../core/data.js";

mountLayout();

const el = document.querySelector("[data-about]");

const STATEMENT = {
  es: [
    "Quien no corre, vuela es un proyecto editorial de autoedición que nace de la necesidad de crear colectivamente, entendiendo lo visual como un espacio de expresión, encuentro y comunicación.",
    "Creemos en la fotografía como una herramienta viva, capaz de resistir los cánones elitistas y técnicos que históricamente han intentado limitarla. Nos interesa la imagen cuando se equivoca, cuando duda, cuando se rompe y vuelve a construirse.",
    "Hacemos fanzines que abrazan el error, deconstruyen la mirada y le dan un lugar al archivo, a lo íntimo y a lo cotidiano. Trabajamos desde la experimentación, el juego y el deseo de disfrutar el proceso sin prisas ni reglas.",
    "Más que buscar respuestas, queremos abrir posibilidades.",
  ],
  ca: [
    "Quien no corre, vuela és un projecte editorial d'autoedició que neix de la necessitat de crear col·lectivament, entenent allò visual com un espai d'expressió, trobada i comunicació.",
    "Creiem en la fotografia com una eina viva, capaç de resistir els cànons elitistes i tècnics que històricament han intentat limitar-la. Ens interessa la imatge quan s'equivoca, quan dubta, quan es trenca i es torna a construir.",
    "Fem fanzines que abracen l'error, desconstrueixen la mirada i donen un lloc a l'arxiu, a allò íntim i a allò quotidià. Treballem des de l'experimentació, el joc i el desig de gaudir del procés sense presses ni regles.",
    "Més que buscar respostes, volem obrir possibilitats.",
  ],
  en: [
    "Quien no corre, vuela is a self-publishing editorial project born from the need to create collectively, understanding the visual as a space for expression, encounter and communication.",
    "We believe in photography as a living tool, able to resist the elitist and technical canons that have historically tried to limit it. We are drawn to the image when it errs, when it hesitates, when it breaks and rebuilds itself.",
    "We make fanzines that embrace error, deconstruct the gaze and give a place to the archive, to the intimate and the everyday. We work from experimentation, play and the desire to enjoy the process without haste or rules.",
    "More than seeking answers, we want to open possibilities.",
  ],
};

function render() {
  if (!el) return;
  const paras = STATEMENT[I18N.lang] || STATEMENT.es;
  el.innerHTML = paras
    .map((t, i) => `<p${i === 0 ? ' class="lead"' : ""}>${escapeHtml(t)}</p>`)
    .join("");
}

render();
document.addEventListener("qnc:lang", render);
