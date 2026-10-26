/* MessMate - frontend-only hostel mess prototype.
   Data is stored in localStorage in this browser. This is not secure authentication
   and does not synchronize data between devices. */

(() => {
  "use strict";

  const STORAGE_KEY = "messmate_data_v1";
  const ADMIN_PIN = "1234"; // Demo only. Do not use for a real billing system.
  const MEALS = ["Breakfast", "Lunch", "Snacks", "Dinner"];
  const MEAL_META = {
    Breakfast: { icon: "☀", subtitle: "Start your day" },
    Lunch: { icon: "🍛", subtitle: "Midday meal" },
    Snacks: { icon: "☕", subtitle: "Tea-time bites" },
    Dinner: { icon: "🌙", subtitle: "Evening meal" }
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
  let currentUser = null; // { role: "student"|"admin", admission?: string }
  let activeView = "studentHome";
  let toastTimer = null;

  const $ = (id) => document.getElementById(id);
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const currentMonth = () => todayISO().slice(0, 7);
  const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
  const money = (value) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2
  }).format(Number(value) || 0);
  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };
  const monthName = (month) => {
    if (!month) return "Selected month";
    const d = new Date(`${month}-01T00:00:00`);
    return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };
  const newId = () => `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.foods) && parsed.records && typeof parsed.records === "object") {
          parsed.bills = parsed.bills || {};
          return parsed;
        }
      }
    } catch (err) {
      console.warn("Could not read saved MessMate data:", err);
    }
    return { foods: DEFAULT_FOODS.map(f => ({ ...f })), records: {}, bills: {} };
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
          const foods = ids.map(id => data.foods.find(f => f.id === id)).filter(Boolean);
          const amount = foods.reduce((sum, f) => sum + Number(f.price || 0), 0);
          entries.push({ admission, date, meal, itemIds: ids, foods, amount });
        });
      });
    });
    return entries.sort((a, b) => b.date.localeCompare(a.date) || a.meal.localeCompare(b.meal) || a.admission.localeCompare(b.admission));
  }

  function recordsForStudent(admission) {
    return allRecordEntries().filter(e => e.admission === admission);
  }

  function entriesForMonth(entries, month) {
    return entries.filter(e => e.date.startsWith(month));
  }

  function totalAmount(entries) {
    return entries.reduce((sum, e) => sum + e.amount, 0);
  }

  function uniqueStudents(entries) {
    return [...new Set(entries.map(e => e.admission))].sort((a, b) => a.localeCompare(b));
  }

  function studentDayData(admission, date) {
    return (data.records[admission] && data.records[admission][date]) || {};
  }

  function recordCountForMonth(entries) {
    return entries.reduce((count, e) => count + e.itemIds.length, 0);
  }

  function renderLogin() {
    $("loginScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
    $("studentLoginForm").reset();
    $("adminLoginForm").reset();
    $("adminLoginForm").classList.add("hidden");
    $("showAdminLogin").classList.remove("hidden");
    $("year").textContent = new Date().getFullYear();
  }

  function enterStudent(admission) {
    currentUser = { role: "student", admission };
    $("loginScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");
    $("studentNav").classList.remove("hidden");
    $("adminNav").classList.add("hidden");
    $("topbarName").textContent = admission;
    $("topbarRole").textContent = "Student account";
    $("topbarAvatar").textContent = admission.slice(0, 1).toUpperCase();
    $("studentWelcome").textContent = `Welcome, ${admission}`;
    $("mealDate").value = todayISO();
    $("studentBillMonth").value = currentMonth();
    renderMealEntry();
    showView("studentHome");
  }

  function enterAdmin() {
    currentUser = { role: "admin" };
    $("loginScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");
    $("studentNav").classList.add("hidden");
    $("adminNav").classList.remove("hidden");
    $("topbarName").textContent = "Mess Admin";
    $("topbarRole").textContent = "Administrator";
    $("topbarAvatar").textContent = "A";
    $("adminBillMonth").value = currentMonth();
    $("recordMonth").value = currentMonth();
    renderFoodPrices();
    showView("adminHome");
  }

  function showView(viewId) {
    const allowedStudent = ["studentHome", "mealEntry", "studentBills"];
    const allowedAdmin = ["adminHome", "adminRecords", "adminPrices", "adminBills"];
    if (!currentUser) return;
    const allowed = currentUser.role === "admin" ? allowedAdmin : allowedStudent;
    if (!allowed.includes(viewId)) return;
    activeView = viewId;
    document.querySelectorAll(".view").forEach(view => view.classList.toggle("hidden", view.id !== viewId));
    document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewId));
    const labels = {
      studentHome: "Overview", mealEntry: "Record meals", studentBills: "Monthly bills",
      adminHome: "Overview", adminRecords: "Meal records", adminPrices: "Food & prices", adminBills: "Monthly bills"
    };
    $("topbarSection").textContent = labels[viewId] || "Overview";
    if (viewId === "studentHome") renderStudentHome();
    if (viewId === "mealEntry") renderMealEntry();
    if (viewId === "studentBills") renderStudentBills();
    if (viewId === "adminHome") renderAdminHome();
    if (viewId === "adminRecords") renderAdminRecords();
    if (viewId === "adminPrices") renderFoodPrices();
    if (viewId === "adminBills") renderAdminBillsIntro();
  }

  function renderStudentHome() {
    if (!currentUser || currentUser.role !== "student") return;
    const admission = currentUser.admission;
    const month = currentMonth();
    const entries = recordsForStudent(admission);
    const monthEntries = entriesForMonth(entries, month);
    const todayEntries = entries.filter(e => e.date === todayISO());
    $("studentMonthTotal").textContent = money(totalAmount(monthEntries));
    $("studentMonthLabel").textContent = monthName(month);
    $("studentMealCount").textContent = recordCountForMonth(monthEntries);
    $("studentTodayTotal").textContent = money(totalAmount(todayEntries));
    $("studentBillingMonth").textContent = `${monthName(month)} bill`;
    const todayByMeal = MEALS.map(meal => {
      const rows = todayEntries.filter(e => e.meal === meal);
      return { meal, foods: rows.flatMap(r => r.foods), amount: totalAmount(rows) };
    });
    $("todayMealsList").innerHTML = todayByMeal.map(item => {
      const meta = MEAL_META[item.meal];
      const foodText = item.foods.length ? item.foods.map(f => f.name).join(", ") : "No food recorded";
      return `<div class="meal-summary-item"><div class="meal-symbol">${meta.icon}</div><div class="meal-summary-main"><strong>${item.meal}</strong><small>${escapeHTML(foodText)}</small></div><div class="meal-cost">${item.amount ? money(item.amount) : "—"}</div></div>`;
    }).join("");
    const recent = entries.slice(0, 7);
    $("studentRecentRows").innerHTML = recent.length ? recent.map(e => `<tr><td>${formatDate(e.date)}</td><td>${escapeHTML(e.meal)}</td><td class="table-food" title="${escapeHTML(e.foods.map(f => f.name).join(", "))}">${escapeHTML(e.foods.map(f => f.name).join(", "))}</td><td class="align-right"><strong>${money(e.amount)}</strong></td></tr>`).join("") : `<tr><td colspan="4"><div class="empty-state"><strong>No meals recorded yet</strong>Use “Record today's meals” to add your first entry.</div></td></tr>`;
  }

  function renderMealEntry() {
    if (!currentUser || currentUser.role !== "student") return;
    const date = $("mealDate").value || todayISO();
    const saved = studentDayData(currentUser.admission, date);
    $("mealEntryGroups").innerHTML = MEALS.map(meal => {
      const foods = data.foods.filter(f => f.meal === meal).sort((a, b) => a.name.localeCompare(b.name));
      const chosen = Array.isArray(saved[meal]) ? saved[meal] : [];
      const meta = MEAL_META[meal];
      const options = foods.length ? foods.map(food => `<label class="food-option"><input type="checkbox" class="food-check" data-meal="${meal}" data-food-id="${food.id}" ${chosen.includes(food.id) ? "checked" : ""} /><span>${escapeHTML(food.name)}</span><strong>${money(food.price)}</strong></label>`).join("") : `<div class="empty-state">No food items configured for this meal.</div>`;
      const count = chosen.filter(id => foods.some(f => f.id === id)).length;
      return `<section class="meal-group"><div class="meal-group-head"><div class="meal-group-emoji">${meta.icon}</div><div><strong>${meal}</strong><small>${count} item${count === 1 ? "" : "s"} selected</small></div></div><div class="food-options">${options}</div></section>`;
    }).join("");
    updateEntryTotal();
  }

  function selectedFoodIds() {
    const result = {};
    MEALS.forEach(meal => { result[meal] = []; });
    document.querySelectorAll(".food-check:checked").forEach(input => {
      if (result[input.dataset.meal]) result[input.dataset.meal].push(input.dataset.foodId);
    });
    return result;
  }

  function updateEntryTotal() {
    const selected = selectedFoodIds();
    const ids = new Set(Object.values(selected).flat());
    const total = data.foods.filter(f => ids.has(f.id)).reduce((sum, f) => sum + Number(f.price || 0), 0);
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
    if (!data.records[currentUser.admission]) data.records[currentUser.admission] = {};
    // Keep a date entry even when all meals are unselected, so a cleared day removes old selections.
    data.records[currentUser.admission][date] = {};
    MEALS.forEach(meal => {
      if (selected[meal].length) data.records[currentUser.admission][date][meal] = selected[meal];
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
      const rows = entries.filter(e => e.meal === meal);
      return { meal, amount: totalAmount(rows), foods: rows.flatMap(e => e.foods), days: new Set(rows.map(e => e.date)).size, count: recordCountForMonth(rows) };
    });
    const total = totalAmount(entries);
    return `<article class="bill-card">
      <div class="bill-card-header"><div><p class="eyebrow">MONTHLY MESS BILL</p><h3>${escapeHTML(admission)}</h3><p>${escapeHTML(monthName(month))}</p></div><div class="bill-total">${money(total)}</div></div>
      <div class="bill-card-body">${byMeal.map(item => `<div class="bill-meal-line"><span><strong>${item.meal}</strong><br><span class="muted">${item.count} item selection${item.count === 1 ? "" : "s"} · ${item.days} day${item.days === 1 ? "" : "s"}</span></span><span class="bill-food-list">${item.amount ? money(item.amount) : "—"}</span></div>`).join("")}
        <div class="bill-meal-line"><strong>Food items recorded</strong><span class="bill-food-list">${entries.flatMap(e => e.foods.map(f => f.name)).length ? escapeHTML(entries.flatMap(e => e.foods.map(f => f.name)).join(", ")) : "No meals recorded"}</span></div>
      </div>
      <div class="bill-card-footer"><span>Calculated from saved meal records · No fixed monthly fee included</span><div class="bill-actions no-print"><button class="button button-outline button-small" data-print-bill="${escapeHTML(admission)}" data-print-month="${escapeHTML(month)}">Print bill</button></div></div>
    </article>`;
  }

  function renderStudentBills() {
    if (!currentUser || currentUser.role !== "student") return;
    const month = $("studentBillMonth").value || currentMonth();
    const entries = entriesForMonth(recordsForStudent(currentUser.admission), month);
    const amount = totalAmount(entries);
    $("studentBillContent").innerHTML = `<div class="bill-summary-strip"><div class="bill-mini-stat"><span>Billing period</span><strong>${escapeHTML(monthName(month))}</strong></div><div class="bill-mini-stat"><span>Food item selections</span><strong>${recordCountForMonth(entries)}</strong></div><div class="bill-mini-stat"><span>Total amount due</span><strong>${money(amount)}</strong></div></div>${buildBillHTML(currentUser.admission, month)}`;
  }

  function renderAdminHome() {
    const month = currentMonth();
    const entries = entriesForMonth(allRecordEntries(), month);
    $("adminStudentCount").textContent = uniqueStudents(entries).length;
    $("adminMealCount").textContent = entries.length;
    $("adminMonthTotal").textContent = money(totalAmount(entries));
    $("adminMonthFoot").textContent = monthName(month);
    $("adminMealBreakdown").innerHTML = MEALS.map(meal => {
      const amount = totalAmount(entries.filter(e => e.meal === meal));
      const total = totalAmount(entries);
      const percent = total ? (amount / total) * 100 : 0;
      return `<div class="breakdown-row"><span>${meal}</span><div class="breakdown-track"><div class="breakdown-fill" style="width:${percent}%"></div></div><strong>${money(amount)}</strong></div>`;
    }).join("");
    const recent = allRecordEntries().slice(0, 6);
    $("adminRecentRows").innerHTML = recent.length ? recent.map(e => adminRecordRow(e)).join("") : `<tr><td colspan="5"><div class="empty-state"><strong>No meal records yet</strong>Student records will appear here after meals are saved.</div></td></tr>`;
  }

  function adminRecordRow(e) {
    const foods = e.foods.map(f => f.name).join(", ");
    return `<tr><td>${formatDate(e.date)}</td><td><strong>${escapeHTML(e.admission)}</strong></td><td>${escapeHTML(e.meal)}</td><td class="table-food" title="${escapeHTML(foods)}">${escapeHTML(foods)}</td><td class="align-right"><strong>${money(e.amount)}</strong></td></tr>`;
  }

  function renderAdminRecords() {
    const query = ($("recordSearch").value || "").trim().toLowerCase();
    const month = $("recordMonth").value;
    let entries = allRecordEntries();
    if (month) entries = entriesForMonth(entries, month);
    if (query) entries = entries.filter(e => e.admission.toLowerCase().includes(query) || e.meal.toLowerCase().includes(query) || e.foods.some(f => f.name.toLowerCase().includes(query)));
    $("adminRecordRows").innerHTML = entries.length ? entries.map(adminRecordRow).join("") : `<tr><td colspan="5"><div class="empty-state"><strong>No matching records</strong>Try another admission number, food item, or month.</div></td></tr>`;
  }

  function renderFoodPrices() {
    $("foodPriceRows").innerHTML = data.foods.slice().sort((a, b) => MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || a.name.localeCompare(b.name)).map(food => `<tr><td><div class="food-name-cell"><span class="food-mini-icon">${MEAL_META[food.meal]?.icon || "🍽"}</span><strong>${escapeHTML(food.name)}</strong></div></td><td><span class="pill pill-blue">${escapeHTML(food.meal)}</span></td><td class="align-right"><strong>${money(food.price)}</strong></td><td class="align-right"><button class="action-link" data-edit-food="${food.id}">Edit</button><button class="action-link danger" data-delete-food="${food.id}">Delete</button></td></tr>`).join("") || `<tr><td colspan="4"><div class="empty-state">No food items configured.</div></td></tr>`);
  }

  function renderAdminBillsIntro() {
    const month = $("adminBillMonth").value || currentMonth();
    const existing = $("adminBillResults").dataset.month === month && $("adminBillResults").innerHTML.trim();
    if (!existing) {
      $("adminBillResults").innerHTML = `<div class="panel"><div class="empty-state"><strong>Ready to calculate ${escapeHTML(monthName(month))}</strong>Select a billing month and click “Generate monthly bills”. The system will total each student's recorded food items.</div></div>`;
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
    data.bills[month] = { generatedAt: new Date().toISOString(), studentCount: students.length, total, itemCount };
    saveData();
    $("adminBillResults").dataset.month = month;
    if (!students.length) {
      $("adminBillResults").innerHTML = `<div class="panel"><div class="empty-state"><strong>No bills to generate for ${escapeHTML(monthName(month))}</strong>No students have saved meals in this month. Bills will appear once meal records exist.</div></div>`;
      showToast("No meal records were found for that month.");
      return;
    }
    const cards = students.map(admission => buildBillHTML(admission, month)).join("");
    $("adminBillResults").innerHTML = `<div class="bill-summary-strip"><div class="bill-mini-stat"><span>Billing period</span><strong>${escapeHTML(monthName(month))}</strong></div><div class="bill-mini-stat"><span>Students billed</span><strong>${students.length}</strong></div><div class="bill-mini-stat"><span>Total recorded charges</span><strong>${money(total)}</strong></div></div><div class="panel no-print"><div class="panel-heading"><div><h3>Generation summary</h3><p class="muted">Created ${new Date().toLocaleString("en-IN")} · ${itemCount} food item selections</p></div><button id="printAllBills" class="button button-primary">Print all bills</button></div><p class="hint">Bills are calculated from the current menu prices and saved meal entries. Generating a bill does not process a payment.</p></div>${cards}`;
    showToast(`${students.length} monthly bill${students.length === 1 ? "" : "s"} generated.`);
  }

  function printSingleBill(admission, month) {
    const previousView = activeView;
    const temp = document.createElement("div");
    temp.className = "print-only";
    temp.innerHTML = `<h1>Hostel Mess Management</h1><p>Monthly bill · ${escapeHTML(monthName(month))}</p>${buildBillHTML(admission, month)}`;
    document.body.appendChild(temp);
    window.print();
    temp.remove();
    if (previousView !== activeView) showView(previousView);
  }

  function addFood(event) {
    event.preventDefault();
    const name = $("foodName").value.trim();
    const meal = $("foodMeal").value;
    const price = Number($("foodPrice").value);
    if (!name || !Number.isFinite(price) || price < 0) return showToast("Enter a valid food name and price.", true);
    if (data.foods.some(f => f.name.toLowerCase() === name.toLowerCase() && f.meal === meal)) return showToast("That food item already exists in this meal category.", true);
    data.foods.push({ id: newId(), name, meal, price: Math.round(price * 100) / 100 });
    if (saveData()) {
      $("foodForm").reset();
      $("foodForm").classList.add("hidden");
      renderFoodPrices();
      showToast("Food item added.");
    }
  }

  function openEditFood(id) {
    const food = data.foods.find(f => f.id === id);
    if (!food) return;
    $("editFoodId").value = food.id;
    $("editFoodName").value = food.name;
    $("editFoodMeal").value = food.meal;
    $("editFoodPrice").value = food.price;
    $("foodEditModal").classList.remove("hidden");
  }

  function closeEditFood() { $("foodEditModal").classList.add("hidden"); }

  function saveEditedFood(event) {
    event.preventDefault();
    const id = $("editFoodId").value;
    const food = data.foods.find(f => f.id === id);
    if (!food) return closeEditFood();
    const name = $("editFoodName").value.trim();
    const meal = $("editFoodMeal").value;
    const price = Number($("editFoodPrice").value);
    if (!name || !Number.isFinite(price) || price < 0) return showToast("Enter a valid name and price.", true);
    if (data.foods.some(f => f.id !== id && f.name.toLowerCase() === name.toLowerCase() && f.meal === meal)) return showToast("That food item already exists in this meal category.", true);
    Object.assign(food, { name, meal, price: Math.round(price * 100) / 100 });
    if (saveData()) {
      closeEditFood();
      renderFoodPrices();
      renderAdminHome();
      showToast("Food item updated.");
    }
  }

  function deleteFood(id) {
    const food = data.foods.find(f => f.id === id);
    if (!food) return;
    const used = allRecordEntries().some(e => e.itemIds.includes(id));
    const message = used
      ? `Delete "${food.name}" from the menu? Existing records that reference this item will no longer include it in totals.`
      : `Delete "${food.name}" from the menu?`;
    if (!window.confirm(message)) return;
    data.foods = data.foods.filter(f => f.id !== id);
    // Remove deleted food IDs from saved records.
    Object.values(data.records).forEach(days => Object.values(days).forEach(meals => {
      Object.keys(meals).forEach(meal => { meals[meal] = meals[meal].filter(foodId => foodId !== id); if (!meals[meal].length) delete meals[meal]; });
    }));
    if (saveData()) {
      renderFoodPrices();
      renderAdminHome();
      showToast("Food item deleted.");
    }
  }

  // Event handlers
  $("studentLoginForm").addEventListener("submit", event => {
    event.preventDefault();
    const admission = $("admissionInput").value.trim().toUpperCase();
    if (!admission) return showToast("Enter your admission number.", true);
    if (!/^[A-Z0-9-]{2,30}$/.test(admission)) return showToast("Use 2–30 letters, numbers, or hyphens.", true);
    enterStudent(admission);
  });

  $("showAdminLogin").addEventListener("click", () => {
    $("adminLoginForm").classList.remove("hidden");
    $("showAdminLogin").classList.add("hidden");
    $("adminPin").focus();
  });

  $("adminLoginForm").addEventListener("submit", event => {
    event.preventDefault();
    if ($("adminPin").value !== ADMIN_PIN) return showToast("Incorrect demo admin PIN.", true);
    enterAdmin();
  });

  $("logoutButton").addEventListener("click", () => {
    currentUser = null;
    activeView = "studentHome";
    renderLogin();
  });

  document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
  document.addEventListener("click", event => {
    const go = event.target.closest("[data-go]");
    if (go) { event.preventDefault(); showView(go.dataset.go); }
    const edit = event.target.closest("[data-edit-food]");
    if (edit) openEditFood(edit.dataset.editFood);
    const del = event.target.closest("[data-delete-food]");
    if (del) deleteFood(del.dataset.deleteFood);
    const print = event.target.closest("[data-print-bill]");
    if (print) printSingleBill(print.dataset.printBill, print.dataset.printMonth);
  });

  $("mealDate").addEventListener("change", renderMealEntry);
  $("mealEntryGroups").addEventListener("change", updateEntryTotal);
  $("saveMealsButton").addEventListener("click", saveMealRecord);
  $("studentBillMonth").addEventListener("change", renderStudentBills);
  $("recordSearch").addEventListener("input", renderAdminRecords);
  $("recordMonth").addEventListener("change", renderAdminRecords);
  $("clearRecordFilters").addEventListener("click", () => { $("recordSearch").value = ""; $("recordMonth").value = ""; renderAdminRecords(); });
  $("addFoodButton").addEventListener("click", () => { $("foodForm").classList.remove("hidden"); $("foodName").focus(); });
  $("cancelFoodButton").addEventListener("click", () => { $("foodForm").reset(); $("foodForm").classList.add("hidden"); });
  $("foodForm").addEventListener("submit", addFood);
  $("editFoodForm").addEventListener("submit", saveEditedFood);
  $("closeFoodModal").addEventListener("click", closeEditFood);
  $("cancelEditFood").addEventListener("click", closeEditFood);
  $("foodEditModal").addEventListener("click", event => { if (event.target === $("foodEditModal")) closeEditFood(); });
  $("generateBillsButton").addEventListener("click", generateAdminBills);
  $("adminBillMonth").addEventListener("change", () => {
    $("adminBillResults").dataset.month = "";
    renderAdminBillsIntro();
  });
  $("adminBillResults").addEventListener("click", event => {
    if (event.target.closest("#printAllBills")) window.print();
  });

  // Initialize login screen. Data is initialized in localStorage only after the first save.
  $("year").textContent = new Date().getFullYear();
  renderLogin();
})();
