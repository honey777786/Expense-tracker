

(function () {

  const balanceDisplay = document.getElementById("balance");
  const incomeDisplay = document.getElementById("income");
  const expenseDisplay = document.getElementById("expense");
  const transactionList = document.getElementById("transactions");

  const form = document.getElementById("transaction-form");
  const descInput = document.getElementById("desc");
  const amountInput = document.getElementById("amount");
  const typeSelect = document.getElementById("type");
  const categorySelect = document.getElementById("category");
  const dateInput = document.getElementById("date");

  const filterType = document.getElementById("filterType");
  const filterCategory = document.getElementById("filterCategory");
  const searchText = document.getElementById("searchText");

  const clearBtn = document.getElementById("clearBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

  const submitBtn = document.getElementById("submitBtn");
  const cancelEditBtn = document.getElementById("cancelEdit");
  const formTitle = document.getElementById("formTitle");

  const STORAGE_KEY = "colorful_exp_tracker_v1";

  let transactions = loadFromLocalStorage();
  let editingId = null;

  let pieChart = null;
  let barChart = null;


  function generateId() {
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    );
  }

  function formatMoney(value) {
    const number = Number(value) || 0;
    return "₹" + number.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"'`=\\/]/g, (char) => {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
        "/": "&#x2F;",
        "`": "&#96;",
        "=": "&#61;",
      }[char];
    });
  }


  function loadFromLocalStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (err) {
      console.error("Error loading data", err);
      return [];
    }
  }

  function saveToLocalStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (err) {
      console.error("Error saving data", err);
    }
  }



  function addTransaction({ text, amount, type, category, date }) {
    const newTransaction = {
      id: generateId(),
      text: text.trim(),
      amount: Number(amount).toFixed(2),
      type,
      category,
      date: date || new Date().toISOString().slice(0, 10),
    };

    transactions.unshift(newTransaction);
    saveToLocalStorage();
    renderEverything();
  }

  function updateTransaction(id, updatedValues) {
    transactions = transactions.map((item) =>
      item.id === id ? { ...item, ...updatedValues } : item
    );
    saveToLocalStorage();
    renderEverything();
  }

  function deleteTransaction(id) {
    transactions = transactions.filter((t) => t.id !== id);
    saveToLocalStorage();
    renderEverything();
  }

  function clearAllTransactions() {
    if (!transactions.length) return;
    if (!confirm("Are you sure you want to clear all transactions?")) return;
    transactions = [];
    saveToLocalStorage();
    renderEverything();
  }



  function renderEverything() {
    renderSummary();
    renderTransactionList();
    renderCharts();
  }

  function renderSummary() {
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = totalIncome - totalExpense;

    balanceDisplay.textContent = formatMoney(balance);
    incomeDisplay.textContent = formatMoney(totalIncome);
    expenseDisplay.textContent = formatMoney(totalExpense);
  }

  function matchesFilters(transaction) {
    const typeFilter = filterType.value;
    const categoryFilter = filterCategory.value;
    const search = (searchText.value || "").toLowerCase().trim();

    if (typeFilter !== "all" && transaction.type !== typeFilter) return false;
    if (categoryFilter !== "all" && transaction.category !== categoryFilter)
      return false;
    if (search && !transaction.text.toLowerCase().includes(search)) return false;

    return true;
  }

  function renderTransactionList() {
    transactionList.innerHTML = "";

    const filtered = transactions.filter(matchesFilters);

    if (!filtered.length) {
      transactionList.innerHTML =
        '<li style="color: var(--muted); padding: 8px 0;">No transactions found</li>';
      return;
    }

    filtered.forEach((t) => {
      const item = document.createElement("li");
      item.className = "transaction-item";
      item.dataset.id = t.id;

      item.innerHTML = `
        <div class="tx-left">
          <span class="badge ${
            t.type === "income" ? "income" : "expense"
          }">${t.type === "income" ? "Income" : t.category}</span>
          <div>
            <div class="tx-desc">${escapeHtml(t.text)}</div>
            <div class="tx-meta">${t.date}</div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amt ${
            t.type
          }">${t.type === "income" ? "+ " : "- "}${formatMoney(t.amount)}</div>
          <button class="icon-btn edit">✏️</button>
          <button class="icon-btn del">🗑️</button>
        </div>
      `;

      item.querySelector(".edit").addEventListener("click", () =>
        startEditing(t.id)
      );
      item.querySelector(".del").addEventListener("click", () => {
        if (confirm("Delete this transaction?")) deleteTransaction(t.id);
      });

      transactionList.appendChild(item);
    });
  }


  function renderCharts() {
    const expenses = transactions.filter((t) => t.type === "expense");

    const categoryTotals = expenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {});

    const pieLabels = Object.keys(categoryTotals);
    const pieValues = Object.values(categoryTotals);

    const monthlyTotals = expenses.reduce((acc, t) => {
      const month = t.date.slice(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + Number(t.amount);
      return acc;
    }, {});

    const barLabels = Object.keys(monthlyTotals).sort();
    const barValues = barLabels.map((m) => monthlyTotals[m]);

    const colors = [
      "#ff7a7a",
      "#ffd36b",
      "#7be0c7",
      "#9a8cff",
      "#60a5fa",
      "#f472b6",
      "#a3e635",
    ];

    // Pie chart
    const pieCtx = document.getElementById("pieChart").getContext("2d");
    if (pieChart) pieChart.destroy();

    pieChart = new Chart(pieCtx, {
      type: "pie",
      data: {
        labels: pieLabels,
        datasets: [
          {
            data: pieValues,
            backgroundColor: colors.slice(0, pieLabels.length),
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    });

    // Bar chart
    const barCtx = document.getElementById("barChart").getContext("2d");
    if (barChart) barChart.destroy();

    barChart = new Chart(barCtx, {
      type: "bar",
      data: {
        labels: barLabels,
        datasets: [
          {
            label: "Expenses",
            data: barValues,
            backgroundColor: colors.slice(0, barLabels.length),
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } },
      },
    });
  }


  function startEditing(id) {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    editingId = id;

    descInput.value = tx.text;
    amountInput.value = tx.amount;
    typeSelect.value = tx.type;
    categorySelect.value = tx.category;
    dateInput.value = tx.date;

    formTitle.textContent = "Edit Transaction";
    submitBtn.textContent = "Update";
    cancelEditBtn.style.display = "inline-block";

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditing() {
    editingId = null;
    form.reset();
    formTitle.textContent = "Add Transaction";
    submitBtn.textContent = "Add";
    cancelEditBtn.style.display = "none";
  }



  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const text = descInput.value.trim();
    const amount = Number(amountInput.value);
    const type = typeSelect.value;
    const category = categorySelect.value;
    const date = dateInput.value || new Date().toISOString().slice(0, 10);

    if (!text || !amount || amount <= 0) {
      alert("Please enter a valid description and a non-zero amount.");
      return;
    }

    if (editingId) {
      updateTransaction(editingId, {
        text,
        amount: amount.toFixed(2),
        type,
        category,
        date,
      });
      cancelEditing();
    } else {
      addTransaction({
        text,
        amount: amount.toFixed(2),
        type,
        category,
        date,
      });
    }

    form.reset();
  });

  cancelEditBtn.addEventListener("click", cancelEditing);



  [filterType, filterCategory, searchText].forEach((el) =>
    el.addEventListener("input", renderEverything)
  );


  clearBtn.addEventListener("click", clearAllTransactions);


  exportBtn.addEventListener("click", () => {
    try {
      const data = JSON.stringify(transactions, null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "myspend-backup.json";
      link.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Export failed: " + err.message);
    }
  });

  importBtn.addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);

        if (!Array.isArray(importedData))
          throw new Error("Invalid file structure");

        const valid = importedData.every(
          (item) => item.id && item.text && item.amount
        );
        if (!valid) throw new Error("Invalid transaction data");

        transactions = [...importedData, ...transactions];
        saveToLocalStorage();
        renderEverything();
        alert("Import successful!");
      } catch (err) {
        alert("Import failed: " + err.message);
      }
    };

    reader.readAsText(file);
    importFile.value = "";
  });



  renderEverything();

  window.mySpend = {
    getTransactions: () => transactions,
    clearAll: clearAllTransactions,
  };
})();
