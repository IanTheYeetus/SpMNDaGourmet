const loginCard = document.getElementById("managerLoginCard");
const loginForm = document.getElementById("managerLoginForm");
const loginMessage = document.getElementById("managerLoginMessage");
const panel = document.getElementById("managerPanel");
const createForm = document.getElementById("createAdminForm");
const createMessage = document.getElementById("createMessage");
const accountsList = document.getElementById("accountsList");
const accountsMessage = document.getElementById("accountsMessage");
const refreshButton = document.getElementById("managerRefreshButton");
const logoutButton = document.getElementById("managerLogoutButton");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showLogin() {
  loginCard.classList.remove("hidden");
  panel.classList.add("hidden");
}

function showPanel() {
  loginCard.classList.add("hidden");
  panel.classList.remove("hidden");
}

async function checkSession() {
  const response = await fetch("/api/admin-manager/session");
  const data = await response.json();
  if (data.isAccountManager) {
    showPanel();
    loadAccounts();
  } else {
    showLogin();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "Checking...";
  loginMessage.classList.remove("error");

  try {
    const response = await fetch("/api/admin-manager/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: document.getElementById("managerPassword").value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed.");

    loginForm.reset();
    loginMessage.textContent = "";
    showPanel();
    loadAccounts();
  } catch (error) {
    loginMessage.textContent = error.message;
    loginMessage.classList.add("error");
  }
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  createMessage.textContent = "Creating...";
  createMessage.classList.remove("error");

  try {
    const response = await fetch("/api/admin-manager/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: document.getElementById("newUsername").value,
        password: document.getElementById("newPassword").value
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not create account.");

    createForm.reset();
    createMessage.textContent = `Created ${data.account.username}.`;
    loadAccounts();
  } catch (error) {
    createMessage.textContent = error.message;
    createMessage.classList.add("error");
  }
});

async function loadAccounts() {
  accountsMessage.textContent = "Loading accounts...";
  accountsMessage.classList.remove("error");

  try {
    const response = await fetch("/api/admin-manager/accounts");
    const data = await response.json();

    if (response.status === 401) {
      showLogin();
      throw new Error("Your account-manager session expired.");
    }
    if (!response.ok) throw new Error(data.error || "Could not load accounts.");

    accountsList.innerHTML = "";
    for (const account of data.accounts) {
      const row = document.createElement("div");
      row.className = "account-row";
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(account.username)}</strong>
          <small>Created ${new Date(account.created_at).toLocaleString()}</small>
        </div>
        <div class="account-actions">
          <button class="secondary reset-password" data-id="${account.id}" data-username="${escapeHtml(account.username)}">Reset password</button>
          <button class="delete-button delete-admin" data-id="${account.id}" data-username="${escapeHtml(account.username)}">Delete</button>
        </div>
      `;
      accountsList.appendChild(row);
    }

    accountsMessage.textContent = `${data.accounts.length} admin account${data.accounts.length === 1 ? "" : "s"}`;

    document.querySelectorAll(".reset-password").forEach(button => button.addEventListener("click", resetPassword));
    document.querySelectorAll(".delete-admin").forEach(button => button.addEventListener("click", deleteAdmin));
  } catch (error) {
    accountsMessage.textContent = error.message;
    accountsMessage.classList.add("error");
  }
}

async function resetPassword(event) {
  const button = event.currentTarget;
  const password = prompt(`Enter a new password for ${button.dataset.username} (minimum 8 characters):`);
  if (password === null) return;

  const response = await fetch(`/api/admin-manager/accounts/${button.dataset.id}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  const data = await response.json();
  if (!response.ok) {
    alert(data.error || "Could not reset password.");
    return;
  }
  alert(`Password updated for ${button.dataset.username}.`);
}

async function deleteAdmin(event) {
  const button = event.currentTarget;
  if (!confirm(`Delete admin account ${button.dataset.username}?`)) return;

  const response = await fetch(`/api/admin-manager/accounts/${button.dataset.id}`, {
    method: "DELETE"
  });
  const data = await response.json();
  if (!response.ok) {
    alert(data.error || "Could not delete account.");
    return;
  }
  loadAccounts();
}

refreshButton.addEventListener("click", loadAccounts);
logoutButton.addEventListener("click", async () => {
  await fetch("/api/admin-manager/logout", { method: "POST" });
  showLogin();
});

checkSession();
