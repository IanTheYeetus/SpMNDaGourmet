const form = document.getElementById("lookupForm");
const codeInput = document.getElementById("lookupCode");
const message = document.getElementById("lookupMessage");
const result = document.getElementById("orderResult");

function formatEuro(value) {
  return `€${Number(value).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const code = codeInput.value.trim().toUpperCase();
  message.textContent = "Searching...";
  message.classList.remove("error");
  result.classList.add("hidden");

  try {
    const response = await fetch(`/api/orders/code/${encodeURIComponent(code)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Order not found.");
    }

    const order = data.order;

    result.innerHTML = `
      <div class="result-grid">
        <div class="result-item">
          <strong>Code</strong>
          ${escapeHtml(order.order_code)}
        </div>
        <div class="result-item">
          <strong>Name</strong>
          ${escapeHtml(order.customer_name)}
        </div>
        <div class="result-item">
          <strong>Class</strong>
          ${escapeHtml(order.class_name)}
        </div>
        <div class="result-item">
          <strong>Raspberry · €1.00 each</strong>
          ${order.raspberry_qty} × €1.00 = ${formatEuro(order.line_totals.raspberry)}
        </div>
        <div class="result-item">
          <strong>Strawberry · €1.00 each</strong>
          ${order.strawberry_qty} × €1.00 = ${formatEuro(order.line_totals.strawberry)}
        </div>
        <div class="result-item">
          <strong>Chocolate · €1.50 each</strong>
          ${order.chocolate_qty} × €1.50 = ${formatEuro(order.line_totals.chocolate)}
        </div>
        <div class="result-item total-result">
          <strong>Total</strong>
          <span class="result-total">${formatEuro(order.total)}</span>
        </div>
        <div class="result-item">
          <strong>Status</strong>
          ${escapeHtml(order.status)}
        </div>
      </div>
    `;

    message.textContent = "";
    result.classList.remove("hidden");
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
});
