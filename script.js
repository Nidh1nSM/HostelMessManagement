
/* MessMate - Hostel Mess Management
   Frontend-only demo. Data is stored in this browser's localStorage.
   This is not secure authentication and does not sync across devices.
*/
(() => {
  "use strict";

  const STORAGE_KEY = "messmate_data_v1";
  const ADMIN_PIN = "1234";
  const MEALS = ["Breakfast", "Lunch", "Snacks", "Dinner"];

  const MEAL_META = {
    Breakfast: { icon: "☀" },
    Lunch: { icon: "🍛" },
    Snacks: { icon: "☕" },
    Dinner: { icon: "🌙" }
  };

  const DEFAULT_FOODS = [
    { id: "f1", name: "Idli", meal: "Breakfast", price: 10 },
    { id: "f2", name: "Dosa", meal: "Breakfast", price: 20 },
    { id: "f3", name: "Chapati", meal: "Breakfast", price: 10 },
    { id: "f4", name: "Tea", meal: "Snacks", price: 10 },
    { id: "f5", name: "Banana", meal: "Snacks", price: 10 },
    { id: "f6", name: "Puffs", meal: "Snacks", price: 20 },
    { id: "f7", name: "Rice", meal: "Lunch", price: 20 },
    { id: "f8", name: "Vegetable curry", meal: "Lunch", price: 15 },
    { id: "f9", name: "Fish curry", meal: "Lunch", price: 30 },
    { id: "f10", name: "Rice", meal: "Dinner", price: 20 },
    { id: "f11", name: "Chapati", meal: "Dinner", price: 10 },
    { id: "f12", name: "Chicken curry", meal: "Dinner", price: 35 }
  ];

  let data = loadData();
  let currentUser = null;
  let activeView = "studentHome";
  let toastTimer = null;

  const $ = id => document.getElementById(id);

  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function currentMonth() {
    return todayISO().slice(0, 7);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function monthName(month) {
    if (!month) return "Selected month";
    const d = new Date(`${month}-01T00:00:00`);
    return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });
  }

  function newId() {
    return `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);

        if (parsed && Array.isArray(parsed.foods) &&
            parsed.records && typeof parsed.records === "object") {
          parsed.bills = parsed.bills || {};
          parsed.students = parsed.students || {};
          parsed.admins = parsed.admins || [];
          return parsed;
        }
      }
    } catch (err) {
      console.warn("Could not read saved MessMate data:", err);
    }

    return {
      foods: DEFAULT_FOODS.map(food => ({ ...food })),
      records: {},
      bills: {},
      students: {},
      admins: []
    };
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      showToast("Could not save data. Browser storage may be full or disabled.", true);
      console.error(err);
      return false;
    }
  }

  function showToast(message, isError = false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function allRecordEntries() {
    const entries = [];

    Object.entries(data.records).forEach(([admission, days]) => {
      Object.entries(days || {}).forEach(([date, meals]) => {
        Object.entries(meals || {}).forEach(([meal, itemIds]) => {
          const ids = Array.isArray(itemIds) ? itemIds : [];
          if (!ids.length) return;

          const foods = ids
            .map(id => data.foods.find(food => food.id === id))
            .filter(Boolean);

          const amount = foods.reduce(
            (sum, food) => sum + Number(food.price || 0), 0
          );

          entries.push({ admission, date, meal, itemIds: ids, foods, amount });
        });
      });
    });

    return entries.sort((a, b) =>
      b.date.localeCompare(a.date) ||
      a.meal.localeCompare(b.meal) ||
      a.admission.localeCompare(b.admission)
    );
  }

  function recordsForStudent(admission) {
    return allRecordEntries().filter(entry => entry.admission === admission);
  }

  function entriesForMonth(entries, month) {
    return entries.filter(entry => entry.date.startsWith(month));
  }

  function totalAmount(entries) {
    return entries.reduce((sum, entry) => sum + entry.amount, 0);
  }

  function uniqueStudents(entries) {
    return [...new Set(entries.map(entry => entry.admission))]
      .sort((a, b) => a.localeCompare(b));
  }

  function studentDayData(admission, date) {
    return (data.records[admission] && data.records[admission][date]) || {};
  }

  function recordCountForMonth(entries) {
    return entries.reduce((count, entry) => count + entry.itemIds.length, 0);
  }

  function renderLogin() {
    $("loginScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
    $("studentLoginForm").reset();
    $("studentRegisterForm").reset();
    $("studentRegisterForm").classList.add("hidden");
    $("adminLoginForm").reset();
    $("adminLoginForm").classList.add("hidden");
    $("showAdminLogin").classList.remove("hidden");
    $("year").textContent = new Date().getFullYear();
  }

  function enterStudent(admission) {
    const account = data.students[admission] || { name: admission };

    currentUser = {
      role: "student",
      admission,
      name: account.name
    };

    $("loginScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");
    $("studentNav").classList.remove("hidden");
    $("adminNav").classList.add("hidden");
    $("topbarName").textContent = account.name || admission;
    $("topbarRole").textContent = `Student · ${admission}`;
    $("topbarAvatar").textContent = admission.slice(0, 1).toUpperCase();
    $("studentWelcome").textContent = `Welcome, ${account.name || admission}`;
    $("mealDate").value = todayISO();
    $("studentBillMonth").value = currentMonth();

    renderMealEntry();
    showView("studentHome");
  }

  function enterAdmin(adminAccount = null) {
    currentUser = {
      role: "admin",
      username: adminAccount?.username || "admin",
      name: adminAccount?.name || "Mess Admin"
    };

    $("loginScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");
    $("studentNav").classList.add("hidden");
    $("adminNav").classList.remove("hidden");
    $("topbarName").textContent = currentUser.name;
    $("topbarRole").textContent = `Administrator · ${currentUser.username}`;
    $("topbarAvatar").textContent = "A";
    $("adminBillMonth").value = currentMonth();
    $("recordMonth").value = currentMonth();

    renderFoodPrices();
    showView("adminHome");
  }

  function showView(viewId) {
    const allowedStudent = ["studentHome", "mealEntry", "studentBills"];
    const allowedAdmin = [
      "adminHome", "adminRecords", "adminPrices", "adminBills", "adminUsers"
    ];

    if (!currentUser) return;

    const allowed = currentUser.role === "admin" ? allowedAdmin : allowedStudent;
    if (!allowed.includes(viewId)) return;

    activeView = viewId;

    document.querySelectorAll(".view").forEach(view => {
      view.classList.toggle("hidden", view.id !== viewId);
    });

    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle("active", button.dataset.view === viewId);
    });

    const labels = {
      studentHome: "Overview",
      mealEntry: "Record meals",
      studentBills: "Monthly bills",
      adminHome: "Overview",
      adminRecords: "Meal records",
      adminPrices: "Food & prices",
      adminBills: "Monthly bills",
      adminUsers: "Admin accounts"
    };

    $("topbarSection").textContent = labels[viewId] || "Overview";

    if (viewId === "studentHome") renderStudentHome();
    if (viewId === "mealEntry") renderMealEntry();
    if (viewId === "studentBills") renderStudentBills();
    if (viewId === "adminHome") renderAdminHome();
    if (viewId === "adminRecords") renderAdminRecords();
    if (viewId === "adminPrices") renderFoodPrices();
    if (viewId === "adminBills") renderAdminBillsIntro();
    if (viewId === "adminUsers") renderAdminUsers();
  }

  function renderStudentHome() {
    if (!currentUser || currentUser.role !== "student") return;

    const admission = currentUser.admission;
    const month = currentMonth();
    const entries = recordsForStudent(admission);
    const monthEntries = entriesForMonth(entries, month);
    const todayEntries = entries.filter(entry => entry.date === todayISO());

    $("studentMonthTotal").textContent = money(totalAmount(monthEntries));
    $("studentMonthLabel").textContent = monthName(month);
    $("studentMealCount").textContent = recordCountForMonth(monthEntries);
    $("studentTodayTotal").textContent = money(totalAmount(todayEntries));
    $("studentBillingMonth").textContent = `${monthName(month)} bill`;

    const todayByMeal = MEALS.map(meal => {
      const rows = todayEntries.filter(entry => entry.meal === meal);
      return {
        meal,
        foods: rows.flatMap(row => row.foods),
        amount: totalAmount(rows)
      };
    });

    $("todayMealsList").innerHTML = todayByMeal.map(item => {
      const meta = MEAL_META[item.meal];
      const foodText = item.foods.length
        ? item.foods.map(food => food.name).join(", ")
        : "No food recorded";

      return `<div class="meal-summary-item">
        <div class="meal-symbol">${meta.icon}</div>
        <div class="meal-summary-main">
          <strong>${item.meal}</strong>
          <small>${escapeHTML(foodText)}</small>
        </div>
        <div class="meal-cost">${item.amount ? money(item.amount) : "—"}</div>
      </div>`;
    }).join("");

    const recent = entries.slice(0, 7);

    $("studentRecentRows").innerHTML = recent.length
      ? recent.map(entry => `<tr>
          <td>${formatDate(entry.date)}</td>
          <td>${escapeHTML(entry.meal)}</td>
          <td class="table-food">${escapeHTML(entry.foods.map(food => food.name).join(", "))}</td>
          <td class="align-right"><strong>${money(entry.amount)}</strong></td>
        </tr>`).join("")
      : `<tr><td colspan="4"><div class="empty-state">
          <strong>No meals recorded yet</strong>
          Use “Record today's meals” to add your first entry.
        </div></td></tr>`;
  }

  function renderMealEntry() {
    if (!currentUser || currentUser.role !== "student") return;

    const date = $("mealDate").value || todayISO();
    const saved = studentDayData(currentUser.admission, date);

    $("mealEntryGroups").innerHTML = MEALS.map(meal => {
      const foods = data.foods
        .filter(food => food.meal === meal)
        .sort((a, b) => a.name.localeCompare(b.name));

      const chosen = Array.isArray(saved[meal]) ? saved[meal] : [];
      const meta = MEAL_META[meal];

      const options = foods.length
        ? foods.map(food => `<label class="food-option">
            <input type="checkbox" class="food-check"
              data-meal="${meal}" data-food-id="${food.id}"
              ${chosen.includes(food.id) ? "checked" : ""} />
            <span>${escapeHTML(food.name)}</span>
            <strong>${money(food.price)}</strong>
          </label>`).join("")
        : `<div class="empty-state">No food items configured for this meal.</div>`;

      const count = chosen.filter(id => foods.some(food => food.id === id)).length;

      return `<section class="meal-group">
        <div class="meal-group-head">
          <div class="meal-group-emoji">${meta.icon}</div>
          <div><strong>${meal}</strong>
            <small>${count} item${count === 1 ? "" : "s"} selected</small>
          </div>
        </div>
        <div class="food-options">${options}</div>
      </section>`;
    }).join("");

    updateEntryTotal();
  }

  function selectedFoodIds() {
    const result = {};
    MEALS.forEach(meal => { result[meal] = []; });

    document.querySelectorAll(".food-check:checked").forEach(input => {
      if (result[input.dataset.meal]) {
        result[input.dataset.meal].push(input.dataset.foodId);
      }
    });

    return result;
  }

  function updateEntryTotal() {
    const selected = selectedFoodIds();
    const ids = new Set(Object.values(selected).flat());

    const total = data.foods
      .filter(food => ids.has(food.id))
      .reduce((sum, food) => sum + Number(food.price || 0), 0);

    $("entryTotal").textContent = money(total);

    document.querySelectorAll(".meal-group").forEach(group => {
      const count = group.querySelectorAll(".food-check:checked").length;
      const small = group.querySelector(".meal-group-head small");
      if (small) small.textContent = `${count} item${count === 1 ? "" : "s"} selected`;
    });
  }

  function saveMealRecord() {
    if (!currentUser || currentUser.role !== "student") return;

    const date = $("mealDate").value;
    if (!date) return showToast("Please select a meal date.", true);
    if (date > todayISO()) return showToast("Future meal records cannot be saved.", true);

    const selected = selectedFoodIds();

    if (!data.records[currentUser.admission]) {
      data.records[currentUser.admission] = {};
    }

    data.records[currentUser.admission][date] = {};

    MEALS.forEach(meal => {
      if (selected[meal].length) {
        data.records[currentUser.admission][date][meal] = selected[meal];
      }
    });

    if (saveData()) {
      showToast("Meal record saved successfully.");
      renderStudentHome();
      renderStudentBills();
    }
  }

  function buildBillHTML(admission, month) {
    const entries = entriesForMonth(recordsForStudent(admission), month);

    const byMeal = MEALS.map(meal => {
      const rows = entries.filter(entry => entry.meal === meal);
      return {
        meal,
        amount: totalAmount(rows),
        days: new Set(rows.map(row => row.date)).size,
        count: recordCountForMonth(rows)
      };
    });

    const total = totalAmount(entries);

    return `<article class="bill-card">
      <div class="bill-card-header">
        <div>
          <p class="eyebrow">MONTHLY MESS BILL</p>
          <h3>${escapeHTML(admission)}</h3>
          <p>${escapeHTML(monthName(month))}</p>
        </div>
        <div class="bill-total">${money(total)}</div>
      </div>
      <div class="bill-card-body">
        ${byMeal.map(item => `<div class="bill-meal-line">
          <span>
            <strong>${item.meal}</strong><br>
            <span class="muted">${item.count} food selection(s) · ${item.days} day(s)</span>
          </span>
          <span class="bill-food-list">${item.amount ? money(item.amount) : "—"}</span>
        </div>`).join("")}
        <div class="bill-meal-line">
          <strong>Food items recorded</strong>
          <span class="bill-food-list">${entries.length
            ? escapeHTML(entries.flatMap(entry => entry.foods.map(food => food.name)).join(", "))
            : "No meals recorded"}</span>
        </div>
      </div>
      <div class="bill-card-footer">
        <span>Calculated from saved meal records · No fixed monthly fee included</span>
        <div class="bill-actions no-print">
          <button class="button button-outline button-small"
            data-print-bill="${escapeHTML(admission)}"
            data-print-month="${escapeHTML(month)}">Print bill</button>
        </div>
      </div>
    </article>`;
  }

  function renderStudentBills() {
    if (!currentUser || currentUser.role !== "student") return;

    const month = $("studentBillMonth").value || currentMonth();
    const entries = entriesForMonth(recordsForStudent(currentUser.admission), month);

    $("studentBillContent").innerHTML = `
      <div class="bill-summary-strip">
        <div class="bill-mini-stat">
          <span>Billing period</span><strong>${escapeHTML(monthName(month))}</strong>
        </div>
        <div class="bill-mini-stat">
          <span>Food item selections</span><strong>${recordCountForMonth(entries)}</strong>
        </div>
        <div class="bill-mini-stat">
          <span>Total amount due</span><strong>${money(totalAmount(entries))}</strong>
        </div>
      </div>
      ${buildBillHTML(currentUser.admission, month)}`;
  }

  function renderAdminHome() {
    const month = currentMonth();
    const entries = entriesForMonth(allRecordEntries(), month);

    $("adminStudentCount").textContent = uniqueStudents(entries).length;
    $("adminMealCount").textContent = entries.length;
    $("adminMonthTotal").textContent = money(totalAmount(entries));
    $("adminMonthFoot").textContent = monthName(month);

    $("adminMealBreakdown").innerHTML = MEALS.map(meal => {
      const amount = totalAmount(entries.filter(entry => entry.meal === meal));
      const total = totalAmount(entries);
      const percent = total ? amount / total * 100 : 0;

      return `<div class="breakdown-row">
        <span>${meal}</span>
        <div class="breakdown-track">
          <div class="breakdown-fill" style="width:${percent}%"></div>
        </div>
        <strong>${money(amount)}</strong>
      </div>`;
    }).join("");

    const recent = allRecordEntries().slice(0, 6);

    $("adminRecentRows").innerHTML = recent.length
      ? recent.map(adminRecordRow).join("")
      : `<tr><td colspan="5"><div class="empty-state">
          <strong>No meal records yet</strong>
          Student records will appear here after meals are saved.
        </div></td></tr>`;
  }

  function adminRecordRow(entry) {
    const foods = entry.foods.map(food => food.name).join(", ");

    return `<tr>
      <td>${formatDate(entry.date)}</td>
      <td><strong>${escapeHTML(entry.admission)}</strong></td>
      <td>${escapeHTML(entry.meal)}</td>
      <td class="table-food" title="${escapeHTML(foods)}">${escapeHTML(foods)}</td>
      <td class="align-right"><strong>${money(entry.amount)}</strong></td>
    </tr>`;
  }

  function renderAdminRecords() {
    const query = ($("recordSearch").value || "").trim().toLowerCase();
    const month = $("recordMonth").value;
    let entries = allRecordEntries();

    if (month) entries = entriesForMonth(entries, month);

    if (query) {
      entries = entries.filter(entry =>
        entry.admission.toLowerCase().includes(query) ||
        entry.meal.toLowerCase().includes(query) ||
        entry.foods.some(food => food.name.toLowerCase().includes(query))
      );
    }

    $("adminRecordRows").innerHTML = entries.length
      ? entries.map(adminRecordRow).join("")
      : `<tr><td colspan="5"><div class="empty-state">
          <strong>No matching records</strong>
          Try another admission number, food item, or month.
        </div></td></tr>`;
  }

  function renderFoodPrices() {
    const foods = data.foods.slice().sort((a, b) =>
      MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) ||
      a.name.localeCompare(b.name)
    );

    $("foodPriceRows").innerHTML = foods.length
      ? foods.map(food => `<tr>
          <td><div class="food-name-cell">
            <span class="food-mini-icon">${MEAL_META[food.meal]?.icon || "🍽"}</span>
            <strong>${escapeHTML(food.name)}</strong>
          </div></td>
          <td><span class="pill pill-blue">${escapeHTML(food.meal)}</span></td>
          <td class="align-right"><strong>${money(food.price)}</strong></td>
          <td class="align-right">
            <button class="action-link" data-edit-food="${food.id}">Edit</button>
            <button class="action-link danger" data-delete-food="${food.id}">Delete</button>
          </td>
        </tr>`).join("")
      : `<tr><td colspan="4"><div class="empty-state">No food items configured.</div></td></tr>`;
  }

  function renderAdminBillsIntro() {
    const month = $("adminBillMonth").value || currentMonth();
    const existing = $("adminBillResults").dataset.month === month &&
      $("adminBillResults").innerHTML.trim();

    if (!existing) {
      $("adminBillResults").innerHTML = `<div class="panel">
        <div class="empty-state">
          <strong>Ready to calculate ${escapeHTML(monthName(month))}</strong>
          Select a billing month and click “Generate monthly bills”.
          The system will total each student's recorded food items.
        </div>
      </div>`;
      $("adminBillResults").dataset.month = "";
    }
  }

  function generateAdminBills() {
    const month = $("adminBillMonth").value;
    if (!month) return showToast("Please choose a billing month.", true);

    const entries = entriesForMonth(allRecordEntries(), month);
    const students = uniqueStudents(entries);
    const total = totalAmount(entries);
    const itemCount = recordCountForMonth(entries);

    data.bills[month] = {
      generatedAt: new Date().toISOString(),
      studentCount: students.length,
      total,
      itemCount
    };
    saveData();

    $("adminBillResults").dataset.month = month;

    if (!students.length) {
      $("adminBillResults").innerHTML = `<div class="panel">
        <div class="empty-state">
          <strong>No bills to generate for ${escapeHTML(monthName(month))}</strong>
          No students have saved meals in this month.
        </div>
      </div>`;
      showToast("No meal records were found for that month.");
      return;
    }

    const cards = students.map(admission => buildBillHTML(admission, month)).join("");

    $("adminBillResults").innerHTML = `
      <div class="bill-summary-strip">
        <div class="bill-mini-stat"><span>Billing period</span><strong>${escapeHTML(monthName(month))}</strong></div>
        <div class="bill-mini-stat"><span>Students billed</span><strong>${students.length}</strong></div>
        <div class="bill-mini-stat"><span>Total recorded charges</span><strong>${money(total)}</strong></div>
      </div>
      <div class="panel no-print">
        <div class="panel-heading">
          <div><h3>Generation summary</h3>
            <p class="muted">Created ${new Date().toLocaleString("en-IN")} · ${itemCount} food item selections</p>
          </div>
          <button id="printAllBills" class="button button-primary">Print all bills</button>
        </div>
        <p class="hint">Generating a bill does not process a payment.</p>
      </div>
      ${cards}`;

    showToast(`${students.length} monthly bill${students.length === 1 ? "" : "s"} generated.`);
  }

  function printSingleBill(admission, month) {
    const temp = document.createElement("div");
    temp.className = "print-only";
    temp.innerHTML = `<h1>Hostel Mess Management</h1>
      <p>Monthly bill · ${escapeHTML(monthName(month))}</p>
      ${buildBillHTML(admission, month)}`;

    document.body.appendChild(temp);
    window.print();
    temp.remove();
  }

  function addFood(event) {
    event.preventDefault();

    const name = $("foodName").value.trim();
    const meal = $("foodMeal").value;
    const price = Number($("foodPrice").value);

    if (!name || !Number.isFinite(price) || price < 0) {
      return showToast("Enter a valid food name and price.", true);
    }

    if (data.foods.some(food =>
      food.name.toLowerCase() === name.toLowerCase() && food.meal === meal
    )) {
      return showToast("That food item already exists in this meal category.", true);
    }

    data.foods.push({
      id: newId(),
      name,
      meal,
      price: Math.round(price * 100) / 100
    });

    if (saveData()) {
      $("foodForm").reset();
      $("foodForm").classList.add("hidden");
      renderFoodPrices();
      showToast("Food item added.");
    }
  }

  function openEditFood(id) {
    const food = data.foods.find(item => item.id === id);
    if (!food) return;

    $("editFoodId").value = food.id;
    $("editFoodName").value = food.name;
    $("editFoodMeal").value = food.meal;
    $("editFoodPrice").value = food.price;
    $("foodEditModal").classList.remove("hidden");
  }

  function closeEditFood() {
    $("foodEditModal").classList.add("hidden");
  }

  function saveEditedFood(event) {
    event.preventDefault();

    const id = $("editFoodId").value;
    const food = data.foods.find(item => item.id === id);
    if (!food) return closeEditFood();

    const name = $("editFoodName").value.trim();
    const meal = $("editFoodMeal").value;
    const price = Number($("editFoodPrice").value);

    if (!name || !Number.isFinite(price) || price < 0) {
      return showToast("Enter a valid name and price.", true);
    }

    if (data.foods.some(item =>
      item.id !== id &&
      item.name.toLowerCase() === name.toLowerCase() &&
      item.meal === meal
    )) {
      return showToast("That food item already exists in this meal category.", true);
    }

    Object.assign(food, { name, meal, price: Math.round(price * 100) / 100 });

    if (saveData()) {
      closeEditFood();
      renderFoodPrices();
      renderAdminHome();
      showToast("Food item updated.");
    }
  }

  function deleteFood(id) {
    const food = data.foods.find(item => item.id === id);
    if (!food) return;

    const used = allRecordEntries().some(entry => entry.itemIds.includes(id));
    const message = used
      ? `Delete "${food.name}"? Existing records using it will no longer include it in totals.`
      : `Delete "${food.name}" from the menu?`;

    if (!window.confirm(message)) return;

    data.foods = data.foods.filter(item => item.id !== id);

    Object.values(data.records).forEach(days => {
      Object.values(days).forEach(meals => {
        Object.keys(meals).forEach(meal => {
          meals[meal] = meals[meal].filter(foodId => foodId !== id);
          if (!meals[meal].length) delete meals[meal];
        });
      });
    });

    if (saveData()) {
      renderFoodPrices();
      renderAdminHome();
      showToast("Food item deleted.");
    }
  }

  // STUDENT REGISTRATION AND LOGIN

  function registerStudent(event) {
    event.preventDefault();

    const name = $("registerName").value.trim();
    const admission = $("registerAdmission").value.trim().toUpperCase();
    const password = $("registerPassword").value;

    if (!name) return showToast("Enter the student's name.", true);

    if (!/^[A-Z0-9-]{2,30}$/.test(admission)) {
      return showToast("Admission number must contain 2–30 letters, numbers, or hyphens.", true);
    }

    if (password.length < 4) {
      return showToast("Password must contain at least 4 characters.", true);
    }

    if (data.students[admission]) {
      return showToast("That admission number is already registered.", true);
    }

    data.students[admission] = {
      name,
      password,
      createdAt: new Date().toISOString()
    };

    if (saveData()) {
      $("studentRegisterForm").reset();
      $("studentRegisterForm").classList.add("hidden");
      $("admissionInput").value = admission;
      $("studentPasswordInput").value = password;
      showToast("Student account created.");
      enterStudent(admission);
    }
  }

  function loginStudent(event) {
    event.preventDefault();

    const admission = $("admissionInput").value.trim().toUpperCase();
    const password = $("studentPasswordInput").value;

    if (!admission) return showToast("Enter your admission number.", true);

    if (!/^[A-Z0-9-]{2,30}$/.test(admission)) {
      return showToast("Use 2–30 letters, numbers, or hyphens.", true);
    }

    const account = data.students[admission];

    if (!account) {
      return showToast("Student account not found. Create a new student account first.", true);
    }

    if (account.password !== password) {
      return showToast("Incorrect student password.", true);
    }

    enterStudent(admission);
  }

  // ADMIN ACCOUNTS

  function renderAdminUsers() {
    const admins = data.admins || [];

    $("adminUsersRows").innerHTML = admins.length
      ? admins.map(admin => `<tr>
          <td><strong>${escapeHTML(admin.name)}</strong></td>
          <td>${escapeHTML(admin.username)}</td>
          <td class="align-right">
            <button class="action-link danger"
              data-delete-admin="${escapeHTML(admin.username)}">Delete</button>
          </td>
        </tr>`).join("")
      : `<tr><td colspan="3"><div class="empty-state">
          No additional admin accounts have been created.
        </div></td></tr>`;
  }

  function loginAdmin(event) {
    event.preventDefault();

    const password = $("adminPin").value;
    const username = $("adminUsername").value.trim().toLowerCase();

    // The original admin PIN continues to work when username is blank.
    if (!username && password === ADMIN_PIN) {
      enterAdmin();
      return;
    }

    const account = data.admins.find(admin =>
      admin.username.toLowerCase() === username &&
      admin.password === password
    );

    if (!account) {
      return showToast("Incorrect admin username, password, or demo PIN.", true);
    }

    enterAdmin(account);
  }

  function createAdmin(event) {
    event.preventDefault();

    if (!currentUser || currentUser.role !== "admin") {
      return showToast("Only an administrator can create admin accounts.", true);
    }

    const name = $("newAdminName").value.trim();
    const username = $("newAdminUsername").value.trim().toLowerCase();
    const password = $("newAdminPassword").value;

    if (!name) return showToast("Enter the admin name.", true);

    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return showToast("Username must be 3–30 characters using letters, numbers, dots, underscores, or hyphens.", true);
    }

    if (password.length < 4) {
      return showToast("Password must contain at least 4 characters.", true);
    }

    if (username === "admin" || data.admins.some(admin =>
      admin.username.toLowerCase() === username
    )) {
      return showToast("That username is already in use.", true);
    }

    data.admins.push({
      name,
      username,
      password,
      createdAt: new Date().toISOString()
    });

    if (saveData()) {
      $("createAdminForm").reset();
      renderAdminUsers();
      showToast("Admin account created.");
    }
  }

  function deleteAdmin(username) {
    if (!currentUser || currentUser.role !== "admin") return;

    if (!window.confirm(`Delete admin account "${username}"?`)) return;

    data.admins = data.admins.filter(admin => admin.username !== username);

    if (saveData()) {
      renderAdminUsers();
      showToast("Admin account deleted.");
    }
  }

  // EVENT HANDLERS

  $("studentLoginForm").addEventListener("submit", loginStudent);
  $("studentRegisterForm").addEventListener("submit", registerStudent);

  $("showStudentRegister").addEventListener("click", () => {
    $("studentRegisterForm").classList.toggle("hidden");

    if (!$("studentRegisterForm").classList.contains("hidden")) {
      $("registerName").focus();
    }
  });

  $("showAdminLogin").addEventListener("click", () => {
    $("adminLoginForm").classList.remove("hidden");
    $("showAdminLogin").classList.add("hidden");
    $("adminPin").focus();
  });

  $("adminLoginForm").addEventListener("submit", loginAdmin);
  $("createAdminForm").addEventListener("submit", createAdmin);

  $("logoutButton").addEventListener("click", () => {
    currentUser = null;
    activeView = "studentHome";
    renderLogin();
  });

  document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  document.addEventListener("click", event => {
    const go = event.target.closest("[data-go]");
    if (go) {
      event.preventDefault();
      showView(go.dataset.go);
    }

    const edit = event.target.closest("[data-edit-food]");
    if (edit) openEditFood(edit.dataset.editFood);

    const del = event.target.closest("[data-delete-food]");
    if (del) deleteFood(del.dataset.deleteFood);

    const print = event.target.closest("[data-print-bill]");
    if (print) printSingleBill(print.dataset.printBill, print.dataset.printMonth);

    const deleteAdminButton = event.target.closest("[data-delete-admin]");
    if (deleteAdminButton) deleteAdmin(deleteAdminButton.dataset.deleteAdmin);
  });

  $("mealDate").addEventListener("change", renderMealEntry);
  $("mealEntryGroups").addEventListener("change", updateEntryTotal);
  $("saveMealsButton").addEventListener("click", saveMealRecord);
  $("studentBillMonth").addEventListener("change", renderStudentBills);

  $("recordSearch").addEventListener("input", renderAdminRecords);
  $("recordMonth").addEventListener("change", renderAdminRecords);

  $("clearRecordFilters").addEventListener("click", () => {
    $("recordSearch").value = "";
    $("recordMonth").value = "";
    renderAdminRecords();
  });

  $("addFoodButton").addEventListener("click", () => {
    $("foodForm").classList.remove("hidden");
    $("foodName").focus();
  });

  $("cancelFoodButton").addEventListener("click", () => {
    $("foodForm").reset();
    $("foodForm").classList.add("hidden");
  });

  $("foodForm").addEventListener("submit", addFood);
  $("editFoodForm").addEventListener("submit", saveEditedFood);
  $("closeFoodModal").addEventListener("click", closeEditFood);
  $("cancelEditFood").addEventListener("click", closeEditFood);

  $("foodEditModal").addEventListener("click", event => {
    if (event.target === $("foodEditModal")) closeEditFood();
  });

  $("generateBillsButton").addEventListener("click", generateAdminBills);

  $("adminBillMonth").addEventListener("change", () => {
    $("adminBillResults").dataset.month = "";
    renderAdminBillsIntro();
  });

  $("adminBillResults").addEventListener("click", event => {
    if (event.target.closest("#printAllBills")) window.print();
  });

  // Initialize
  $("year").textContent = new Date().getFullYear();
  renderLogin();
})();
