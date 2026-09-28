const loginCard = document.getElementById("loginCard");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const adminPanel = document.getElementById("adminPanel");
const ordersBody = document.getElementById("ordersBody");
const adminMessage = document.getElementById("adminMessage");
const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");
const signedInAs = document.getElementById("signedInAs");

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

async function checkSession() {
  const response = await fetch("/api/admin/session");
  const data = await response.json();

  if (data.isAdmin) {
    showAdmin(data.username);
    loadOrders();
  } else {
    showLogin();
  }
}

function showLogin() {
  loginCard.classList.remove("hidden");
  adminPanel.classList.add("hidden");
  signedInAs.textContent = "";
}

function showAdmin(username) {
  loginCard.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  signedInAs.textContent = username ? `Signed in as ${username}` : "";
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "Checking...";
  loginMessage.classList.remove("error");

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.getElementById("adminUsername").value,
        password: document.getElementById("adminPassword").value
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed.");

    loginForm.reset();
    loginMessage.textContent = "";
    showAdmin(data.username);
    loadOrders();
  } catch (error) {
    loginMessage.textContent = error.message;
    loginMessage.classList.add("error");
  }
});

async function loadOrders() {
  adminMessage.textContent = "Loading orders...";
  adminMessage.classList.remove("error");

  try {
    const response = await fetch("/api/admin/orders");
    const data = await response.json();

    if (response.status === 401) {
      showLogin();
      throw new Error("Your session expired. Please log in again.");
    }
    if (!response.ok) throw new Error(data.error || "Could not load orders.");

    ordersBody.innerHTML = "";

    for (const order of data.orders) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${escapeHtml(order.order_code)}</strong></td>
        <td>${escapeHtml(order.customer_name)}</td>
        <td>${escapeHtml(order.class_name)}</td>
        <td>${order.raspberry_qty}<br><small>${formatEuro(order.line_totals.raspberry)}</small></td>
        <td>${order.strawberry_qty}<br><small>${formatEuro(order.line_totals.strawberry)}</small></td>
        <td>${order.chocolate_qty}<br><small>${formatEuro(order.line_totals.chocolate)}</small></td>
        <td><strong>${formatEuro(order.total)}</strong></td>
        <td>
          <select class="status-select" data-id="${order.id}">
            ${["Received", "Preparing", "Ready", "Completed", "Cancelled"]
              .map(status => `<option value="${status}" ${status === order.status ? "selected" : ""}>${status}</option>`)
              .join("")}
          </select>
        </td>
        <td>${new Date(order.created_at).toLocaleString()}</td>
        <td><button class="delete-button" data-id="${order.id}">Delete</button></td>
      `;
      ordersBody.appendChild(tr);
    }

    adminMessage.textContent = data.orders.length
      ? `${data.orders.length} order${data.orders.length === 1 ? "" : "s"}`
      : "No orders yet.";

    document.querySelectorAll(".status-select").forEach(select => {
      select.addEventListener("change", updateStatus);
    });
    document.querySelectorAll(".delete-button").forEach(button => {
      button.addEventListener("click", deleteOrder);
    });
  } catch (error) {
    adminMessage.textContent = error.message;
    adminMessage.classList.add("error");
  }
}

async function updateStatus(event) {
  const select = event.currentTarget;
  const response = await fetch(`/api/admin/orders/${select.dataset.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: select.value })
  });

  const data = await response.json();
  if (!response.ok) {
    alert(data.error || "Could not update order.");
    loadOrders();
  }
}

async function deleteOrder(event) {
  const id = event.currentTarget.dataset.id;
  if (!confirm("Delete this order permanently?")) return;

  const response = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
  const data = await response.json();
  if (!response.ok) {
    alert(data.error || "Could not delete order.");
    return;
  }
  loadOrders();
}

refreshButton.addEventListener("click", loadOrders);
logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin/logout", { method: "POST" });
  showLogin();
});

checkSession();
