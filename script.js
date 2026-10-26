/* MessMate - frontend-only hostel mess prototype.
   Data is stored in localStorage in this browser. */

(() => {
  "use strict";

  const STORAGE_KEY = "messmate_data_v1";
  const ADMIN_PIN = "1234";

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
  let currentUser = null;
  let activeView = "studentHome";
  let toastTimer = null;

  const $ = id => document.getElementById(id);

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const currentMonth = () => todayISO().slice(0, 7);

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);

  const money = value => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number(value) || 0);

  const formatDate = iso => {
    if (!iso) return "—";
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric"
        });
  };

  const monthName = month => {
    if (!month) return "Selected month";
    const d = new Date(`${month}-01T00:00:00`);
    return Number.isNaN(d.getTime())
      ? month
      : d.toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric"
        });
  };

  const newId = () =>
    `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw);

        if (
          parsed &&
          Array.isArray(parsed.foods) &&
          parsed.records &&
          typeof parsed.records === "object"
        ) {
          parsed.bills = parsed.bills || {};
          return parsed;
        }
      }
    } catch (err) {
      console.warn("Could not read saved MessMate data:", err);
    }

    return {
      foods: DEFAULT_FOODS.map(food => ({ ...food })),
      records: {},
      bills: {}
    };
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      showToast(
        "Could not save data. Browser storage may be full or disabled.",
        true
      );
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

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
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
            (sum, food) => sum + Number(food.price || 0),
            0
          );

          entries.push({
            admission,
            date,
            meal,
            itemIds: ids,
            foods,
            amount
          });
        });
      });
    });

    return entries.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.meal.localeCompare(b.meal) ||
        a.admission.localeCompare(b.admission)
    );
  }

  function recordsForStudent(admission) {
    return allRecordEntries().filter(
      entry => entry.admission === admission
    );
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
    return (
      data.records[admission] &&
      data.records[admission][date]
    ) || {};
  }

  function recordCountForMonth(entries) {
    return entries.reduce(
      (count, entry) => count + entry.itemIds.length,
      0
    );
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
    const studentViews = [
      "studentHome",
      "mealEntry",
      "studentBills"
    ];

    const adminViews = [
      "adminHome",
      "adminRecords",
      "adminPrices",
      "adminBills"
    ];

    if (!currentUser) return;

    const allowed = currentUser.role === "admin"
      ? adminViews
      : studentViews;

    if (!allowed.includes(viewId)) return;

    activeView = viewId;

    document.querySelectorAll(".view").forEach(view => {
      view.classList.toggle("hidden", view.id !== viewId);
    });

    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.view === viewId
      );
    });

    const labels = {
      studentHome: "Overview",
      mealEntry: "Record meals",
      studentBills: "Monthly bills",
      adminHome: "Overview",
      adminRecords: "Meal records",
      adminPrices: "Food & prices",
      adminBills: "Monthly bills"
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
