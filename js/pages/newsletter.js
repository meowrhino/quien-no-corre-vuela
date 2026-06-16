/**
 * pages/newsletter.js — alta de email → POST /api/newsletter (guarda en D1).
 */
import { mountLayout } from "../core/layout.js";
import { I18N } from "../core/i18n.js";
import { CONFIG } from "../core/config.js";

mountLayout();

const form = document.querySelector("[data-newsletter]");
const reEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

if (form) {
  const feedback = form.querySelector("[data-feedback]");
  const input = form.querySelector('input[name="email"]');
  const btn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email || !reEmail.test(email)) { feedback.textContent = I18N.s("error.generic"); return; }
    btn.disabled = true;
    feedback.textContent = "…";
    try {
      const res = await fetch(`${CONFIG.API_BASE}/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("http " + res.status);
      feedback.textContent = I18N.s("news.ok");
      form.reset();
    } catch (err) {
      console.error(err);
      feedback.textContent = I18N.s("error.generic");
    } finally {
      btn.disabled = false;
    }
  });

  document.addEventListener("qnc:lang", () => (feedback.textContent = ""));
}
