const form = document.getElementById("orderForm");
const message = document.getElementById("orderMessage");
const successBox = document.getElementById("successBox");
const orderCode = document.getElementById("orderCode");
const liveTotal = document.getElementById("liveTotal");
const confirmedTotal = document.getElementById("confirmedTotal");

const prices = { raspberry: 1.00, strawberry: 1.00, chocolate: 1.50 };

function formatEuro(value) {
  return `€${Number(value).toFixed(2)}`;
}

function updateTotal() {
  const raspberry = Number(form.elements.raspberry.value) || 0;
  const strawberry = Number(form.elements.strawberry.value) || 0;
  const chocolate = Number(form.elements.chocolate.value) || 0;
  const total = raspberry * prices.raspberry + strawberry * prices.strawberry + chocolate * prices.chocolate;
  liveTotal.textContent = formatEuro(total);
}

form.querySelectorAll('input[type="number"]').forEach(input => {
  input.addEventListener("input", updateTotal);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "Saving order...";
  message.classList.remove("error");
  successBox.classList.add("hidden");

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not place order.");
    }

    message.textContent = "";
    orderCode.textContent = data.order.order_code;
    confirmedTotal.textContent = formatEuro(data.order.total);
    successBox.classList.remove("hidden");

    form.reset();
    form.querySelectorAll('input[type="number"]').forEach(input => {
      input.value = "0";
    });
    updateTotal();

    successBox.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    message.textContent = error.message;
    message.classList.add("error");
  }
});

updateTotal();
