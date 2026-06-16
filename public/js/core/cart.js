/**
 * core/cart.js — carrito en localStorage.
 * Item: { id, titulo:[...], autor, precio, peso, img, cantidad }.
 * Emite 'qnc:cart' en cada cambio y refresca los badges [data-cart-count].
 */
const CART_KEY = "qnc.cart";

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

export function setCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  renderCartBadge();
  document.dispatchEvent(new CustomEvent("qnc:cart"));
}

export function cartCount() {
  return getCart().reduce((n, it) => n + Number(it.cantidad || 0), 0);
}

export function cartTotal() {
  return getCart().reduce((s, it) => s + Number(it.precio || 0) * Number(it.cantidad || 0), 0);
}

/** Peso total del carrito en gramos (para el cálculo de envío). */
export function cartWeight() {
  return getCart().reduce((g, it) => g + Number(it.peso || 0) * Number(it.cantidad || 0), 0);
}

export function addToCart(item) {
  const cart = getCart();
  const existing = cart.find((it) => it.id === item.id);
  if (existing) existing.cantidad = Number(existing.cantidad) + Number(item.cantidad || 1);
  else cart.push({ ...item, cantidad: Number(item.cantidad || 1) });
  setCart(cart);
}

export function updateQty(id, delta) {
  const cart = getCart()
    .map((it) => (it.id === id ? { ...it, cantidad: Math.max(0, Number(it.cantidad) + delta) } : it))
    .filter((it) => it.cantidad > 0);
  setCart(cart);
}

/** Fija la cantidad de un ítem (input editable). 0 o menos → lo elimina. */
export function setQty(id, n) {
  const cantidad = Math.max(0, Math.floor(Number(n) || 0));
  const cart = getCart()
    .map((it) => (it.id === id ? { ...it, cantidad } : it))
    .filter((it) => it.cantidad > 0);
  setCart(cart);
}

export function removeItem(id) {
  setCart(getCart().filter((it) => it.id !== id));
}

export function clearCart() {
  setCart([]);
}

export function renderCartBadge() {
  const n = cartCount();
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = n;
    el.style.display = n > 0 ? "" : "none";
  });
}
