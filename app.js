const DB_NAME = "creditCardAppDB";
const DB_VERSION = 1;
const DETAIL_STORE = "details";
const SUPPORT_STORE = "supports";
const RESERVE_STORE = "reserves";
const SYNC_URL_STORAGE_KEY = "creditCardAppSyncBaseUrl";

let db = null;
let budgetCategories = [];
let cardNames = [];
let parentDetailOptions = [];

document.addEventListener("DOMContentLoaded", async () => {
  try {
    setupViewNavigation();
    setupMoneyInputNormalization();
    setupSyncSettings();
    setupDateUiFields();
    await initializeDatabase();
    await loadMasterOptions();
    populateMasterOptions();
    await loadParentDetailOptions();
    setupTargetMonthSelectors();
    setupDetailForm();
    setupSupportForm();
    setupReserveForm();
    setupExportButton();
    setupMonthlyTargetMonthSelector();
    setupSyncButton();
    await refreshHomeAndUnsyncedView();
    await renderSupportTargetMonthOptions();
    await renderReserveTargetMonthOptions();
    await renderSupportTargetOptions();
    await renderReserveTargetOptions();
    await renderMonthlyTargetMonthOptions();
    await renderMonthlySummary();
  } catch (error) {
    console.error("初期化エラー:", error);
    alert(`初期化失敗: ${error.message}`);
  }
});

function setupDateUiFields() {
  bindDateUi("detail-date-input", "detail-date-display");
  bindDateUi("support-date-input", "support-date-display");
  bindDateUi("reserve-date-input", "reserve-date-display");
}

function bindDateUi(inputId, displayId) {
  const input = document.getElementById(inputId);
  const display = document.getElementById(displayId);
  if (!input || !display) return;

  const refresh = () => {
    if (input.value) {
      display.textContent = formatDisplayDate(input.value);
      display.classList.remove("placeholder");
    } else {
      display.textContent = "日付を選択してください";
      display.classList.add("placeholder");
    }
  };

  input.addEventListener("change", refresh);
  refresh();
}

function formatDisplayDate(value) {
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

function setupViewNavigation() {
  const buttons = document.querySelectorAll("[data-view]");

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const targetViewId = button.dataset.view;
      showView(targetViewId);

      if (targetViewId === "unsynced-view") {
        await renderUnsyncedDetailList();
      }

      if (targetViewId === "support-view") {
        await renderSupportTargetMonthOptions();
        await renderSupportTargetOptions();
      }

      if (targetViewId === "reserve-view") {
        await renderReserveTargetMonthOptions();
        await renderReserveTargetOptions();
      }

      if (targetViewId === "monthly-view") {
        await renderMonthlyTargetMonthOptions();
        await renderMonthlySummary();
      }
    });
  });
}

function showView(targetViewId) {
  const views = document.querySelectorAll(".view");
  views.forEach((view) => view.classList.remove("active-view"));

  const targetView = document.getElementById(targetViewId);
  if (targetView) {
    targetView.classList.add("active-view");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

async function loadMasterOptions() {
  const savedUrl = loadSavedSyncBaseUrl();

  if (!savedUrl) {
    cardNames = ["Epos", "ANA Pay", "UFJ", "Olive", "Amazon", "セゾン金", "JAL", "NL"];
    budgetCategories = ["食費", "光熱費", "交通費", "娯楽費", "雑費", "不加算"];
    return;
  }

  try {
    const response = await fetch(`${savedUrl}/master`);
    const responseJson = await response.json();

    if (!response.ok || !responseJson?.ok) {
      throw new Error("マスタ取得失敗");
    }

    cardNames = Array.isArray(responseJson.card_names) ? responseJson.card_names : [];
    budgetCategories = Array.isArray(responseJson.budget_categories) ? responseJson.budget_categories : [];

    if (cardNames.length === 0) {
      cardNames = ["Epos", "ANA Pay", "UFJ", "Olive", "Amazon", "セゾン金", "JAL", "NL"];
    }

    if (budgetCategories.length === 0) {
      budgetCategories = ["食費", "光熱費", "交通費", "娯楽費", "雑費", "不加算"];
    }
  } catch (error) {
    console.error("マスタ読込エラー:", error);
    cardNames = ["Epos", "ANA Pay", "UFJ", "Olive", "Amazon", "セゾン金", "JAL", "NL"];
    budgetCategories = ["食費", "光熱費", "交通費", "娯楽費", "雑費", "不加算"];
  }
}

async function loadParentDetailOptions() {
  const savedUrl = loadSavedSyncBaseUrl();

  if (!savedUrl) {
    parentDetailOptions = [];
    return;
  }

  try {
    const response = await fetch(`${savedUrl}/detail-options`);
    const responseJson = await response.json();

    if (!response.ok || !responseJson?.ok || !Array.isArray(responseJson.details)) {
      parentDetailOptions = [];
      return;
    }

    parentDetailOptions = responseJson.details;
  } catch (error) {
    console.error("親ファイル明細候補読込エラー:", error);
    parentDetailOptions = [];
  }
}

function setupTargetMonthSelectors() {
  const supportTargetMonth = document.getElementById("support-target-month");
  const reserveTargetMonth = document.getElementById("reserve-target-month");

  if (supportTargetMonth) {
    supportTargetMonth.addEventListener("change", async () => {
      await renderSupportTargetOptions();
    });
  }

  if (reserveTargetMonth) {
    reserveTargetMonth.addEventListener("change", async () => {
      await renderReserveTargetOptions();
    });
  }
}

function populateMasterOptions() {
  const budgetSelect = document.querySelector('select[name="budgetCategory"]');
  const cardSelect = document.querySelector('select[name="cardName"]');
  if (!budgetSelect || !cardSelect) {
    throw new Error("フォーム内のselect要素を取得できませんでした。");
  }

  budgetSelect.innerHTML = '<option value="">選択してください</option>';
  cardSelect.innerHTML = '<option value="">選択してください</option>';

  budgetCategories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    budgetSelect.appendChild(option);
  });

  cardNames.forEach((cardName) => {
    const option = document.createElement("option");
    option.value = cardName;
    option.textContent = cardName;
    cardSelect.appendChild(option);
  });
}

function setupMoneyInputNormalization() {
  const moneyInputs = document.querySelectorAll('[data-money-input="true"]');

  moneyInputs.forEach((inputElement) => {
    inputElement.addEventListener("change", () => {
      inputElement.value = normalizeMoneyInput(inputElement.value);
    });

    inputElement.addEventListener("blur", () => {
      inputElement.value = normalizeMoneyInput(inputElement.value);
    });
  });
}

function setupSyncSettings() {
  const syncUrlInput = document.getElementById("sync-base-url");
  const saveButton = document.getElementById("save-sync-url-button");
  const statusElement = document.getElementById("sync-url-status");
  if (!syncUrlInput || !saveButton || !statusElement) return;

  const savedUrl = loadSavedSyncBaseUrl();
  if (savedUrl) {
    syncUrlInput.value = savedUrl;
    statusElement.textContent = `保存済みの同期先URL: ${savedUrl}`;
  }

  saveButton.addEventListener("click", async () => {
    const normalizedUrl = normalizeSyncBaseUrl(syncUrlInput.value);

    if (!normalizedUrl) {
      statusElement.textContent = "同期先URLを入力してください。";
      return;
    }

    saveSyncBaseUrl(normalizedUrl);
    syncUrlInput.value = normalizedUrl;
    statusElement.textContent = `同期先URLを保存しました: ${normalizedUrl}`;

    await loadMasterOptions();
    populateMasterOptions();
    await loadParentDetailOptions();
    await renderSupportTargetMonthOptions();
    await renderReserveTargetMonthOptions();
    await renderSupportTargetOptions();
    await renderReserveTargetOptions();
    await renderMonthlyTargetMonthOptions();
    await renderMonthlySummary();
  });
}

function setupSyncButton() {
  const syncButton = document.getElementById("sync-button");
  const statusElement = document.getElementById("sync-url-status");
  const syncUrlInput = document.getElementById("sync-base-url");
  if (!syncButton || !statusElement || !syncUrlInput) return;

  syncButton.addEventListener("click", async () => {
    try {
      const normalizedUrl = normalizeSyncBaseUrl(syncUrlInput.value || loadSavedSyncBaseUrl());

      if (!normalizedUrl) {
        statusElement.textContent = "同期先URLを入力して保存してください。";
        return;
      }

      saveSyncBaseUrl(normalizedUrl);
      syncUrlInput.value = normalizedUrl;

      const exportData = await buildUnsyncedExportData();
      const totalCount =
        exportData.details.length + exportData.supports.length + exportData.reserves.length;

      if (totalCount === 0) {
        statusElement.textContent = "未同期データがありません。";
        alert("未同期データがありません。");
        return;
      }

      syncButton.disabled = true;
      statusElement.textContent = "Macへ送信中です...";

      const response = await fetch(`${normalizedUrl}/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(exportData),
      });

      const responseText = await response.text();
      let responseJson = null;

      try {
        responseJson = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`サーバー応答のJSON解析に失敗しました: ${responseText}`);
      }

      if (!response.ok || !responseJson?.ok) {
        throw new Error(responseJson?.message || `送信に失敗しました: HTTP ${response.status}`);
      }

      await markPayloadAsSynced(exportData);

      const importResults = responseJson.import_results || {};
      const detailImported = Number(importResults.details?.imported || 0);
      const supportImported = Number(importResults.supports?.imported || 0);
      const reserveImported = Number(importResults.reserves?.imported || 0);

      const detailSkipped = Number(importResults.details?.skipped || 0);
      const supportSkipped = Number(importResults.supports?.skipped || 0);
      const reserveSkipped = Number(importResults.reserves?.skipped || 0);

      await loadMasterOptions();
      populateMasterOptions();
      await loadParentDetailOptions();
      await refreshHomeAndUnsyncedView();
      await renderSupportTargetMonthOptions();
      await renderReserveTargetMonthOptions();
      await renderSupportTargetOptions();
      await renderReserveTargetOptions();
      await renderMonthlyTargetMonthOptions();
      await renderMonthlySummary();

      statusElement.textContent =
        `同期完了: 取込 明細${detailImported}件 / 支援金${supportImported}件 / 準備金${reserveImported}件`;

      alert(
        `同期完了\n` +
          `取込: 明細 ${detailImported}件 / 支援金 ${supportImported}件 / 準備金 ${reserveImported}件\n` +
          `スキップ: 明細 ${detailSkipped}件 / 支援金 ${supportSkipped}件 / 準備金 ${reserveSkipped}件\n` +
          `送信対象は同期済みに更新しました。`
      );
    } catch (error) {
      console.error("同期送信エラー:", error);
      statusElement.textContent = `送信失敗: ${error.message}`;
      alert(`送信失敗: ${error.message}`);
    } finally {
      syncButton.disabled = false;
    }
  });
}

async function markPayloadAsSynced(exportData) {
  await markRecordsAsSynced(DETAIL_STORE, exportData.details || []);
  await markRecordsAsSynced(SUPPORT_STORE, exportData.supports || []);
  await markRecordsAsSynced(RESERVE_STORE, exportData.reserves || []);
}

function markRecordsAsSynced(storeName, records) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error(`DBが初期化されていません: ${storeName}`));
      return;
    }

    if (!Array.isArray(records) || records.length === 0) {
      resolve();
      return;
    }

    const transaction = db.transaction([storeName], "readwrite");
    const store = transaction.objectStore(storeName);

    records.forEach((record) => {
      if (!record) return;
      store.put({ ...record, synced: true });
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error(`${storeName} の同期済み更新に失敗しました。`));
  });
}

async function fetchMonthlyFinancials(targetMonth) {
  const savedUrl = loadSavedSyncBaseUrl();
  if (!savedUrl) {
    return {
      card: null,
      support: null,
      reserve: null,
      balance: null,
    };
  }

  try {
    const response = await fetch(
      `${savedUrl}/balance?month=${encodeURIComponent(targetMonth)}`
    );
    const responseJson = await response.json();

    if (!response.ok || !responseJson?.ok) {
      return {
        card: null,
        support: null,
        reserve: null,
        balance: null,
      };
    }

    return {
      card: responseJson.card,
      support: responseJson.support,
      reserve: responseJson.reserve,
      balance: responseJson.balance,
    };
  } catch (error) {
    console.error("月次集計取得エラー:", error);
    return {
      card: null,
      support: null,
      reserve: null,
      balance: null,
    };
  }
}

async function fetchMonthlyOptions() {
  const savedUrl = loadSavedSyncBaseUrl();
  if (!savedUrl) return [];

  try {
    const response = await fetch(`${savedUrl}/months`);
    const responseJson = await response.json();

    if (!response.ok || !responseJson?.ok || !Array.isArray(responseJson.months)) {
      return [];
    }

    return responseJson.months;
  } catch (error) {
    console.error("月一覧取得エラー:", error);
    return [];
  }
}

function normalizeMoneyInput(value) {
  const halfWidthValue = String(value)
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248))
    .replace(/，/g, ",")
    .replace(/．/g, ".");

  return halfWidthValue.replace(/[^\d]/g, "");
}

function normalizeSyncBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function saveSyncBaseUrl(url) {
  localStorage.setItem(SYNC_URL_STORAGE_KEY, url);
}

function loadSavedSyncBaseUrl() {
  return normalizeSyncBaseUrl(localStorage.getItem(SYNC_URL_STORAGE_KEY) || "");
}

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("このブラウザではIndexedDBが利用できません。"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`IndexedDBの初期化に失敗しました: ${request.error?.message || "unknown error"}`));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(DETAIL_STORE)) {
        const detailStore = database.createObjectStore(DETAIL_STORE, { keyPath: "detail_id" });
        detailStore.createIndex("target_month", "target_month", { unique: false });
      }

      if (!database.objectStoreNames.contains(SUPPORT_STORE)) {
        database.createObjectStore(SUPPORT_STORE, { keyPath: "support_id" });
      }

      if (!database.objectStoreNames.contains(RESERVE_STORE)) {
        database.createObjectStore(RESERVE_STORE, { keyPath: "reserve_id" });
      }
    };

    request.onblocked = () => {
      reject(new Error("IndexedDBがblocked状態です。別タブや古い接続を閉じてください。"));
    };
  });
}

function getUniqueDetailMonths() {
  const monthSet = new Set();

  parentDetailOptions.forEach((detail) => {
    const targetMonth = String(detail.target_month || "").trim();
    if (targetMonth) {
      monthSet.add(targetMonth);
    }
  });

  return Array.from(monthSet).sort().reverse();
}

async function renderSupportTargetMonthOptions() {
  const select = document.getElementById("support-target-month");
  if (!select) return;

  const currentValue = select.value;
  const monthItems = await fetchMonthlyOptions();

  select.innerHTML = "";

  const firstOption = document.createElement("option");
  firstOption.value = "";
  firstOption.textContent = "選択してください";
  select.appendChild(firstOption);

  monthItems.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.target_month;
    option.textContent = item.target_month;
    select.appendChild(option);
  });

  const values = monthItems.map((item) => item.target_month);
  if (values.includes(currentValue)) {
    select.value = currentValue;
  }
}

async function renderReserveTargetMonthOptions() {
  const select = document.getElementById("reserve-target-month");
  if (!select) return;

  const currentValue = select.value;
  const monthItems = await fetchMonthlyOptions();

  select.innerHTML = "";

  const firstOption = document.createElement("option");
  firstOption.value = "";
  firstOption.textContent = "選択してください";
  select.appendChild(firstOption);

  monthItems.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.target_month;
    option.textContent = item.target_month;
    select.appendChild(option);
  });

  const values = monthItems.map((item) => item.target_month);
  if (values.includes(currentValue)) {
    select.value = currentValue;
  }
}

function setupDetailForm() {
  const detailForm = document.getElementById("detail-form");
  if (!detailForm) throw new Error("detail-form を取得できませんでした。");

  detailForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      if (!db) throw new Error("DBが初期化されていません。");

      const formData = new FormData(detailForm);

      const detailRecord = {
        detail_id: createRecordId("detail"),
        target_month: normalizeTargetMonth(formData.get("useDate")),
        use_date: String(formData.get("useDate") || "").trim(),
        amount: Number(normalizeMoneyInput(formData.get("amount"))),
        purpose: String(formData.get("purpose") || "").trim(),
        budget_category: String(formData.get("budgetCategory") || "").trim(),
        card_name: String(formData.get("cardName") || "").trim(),
        note: String(formData.get("note") || "").trim(),
        created_at: new Date().toISOString(),
        synced: false,
      };

      const validationMessage = validateDetailRecord(detailRecord);
      if (validationMessage) {
        alert(validationMessage);
        return;
      }

      await saveDetailRecord(detailRecord);
      detailForm.reset();
      syncDateUiReset("detail-date-input", "detail-date-display");
      await refreshHomeAndUnsyncedView();
      await loadParentDetailOptions();
      await renderSupportTargetMonthOptions();
      await renderReserveTargetMonthOptions();
      await renderSupportTargetOptions();
      await renderReserveTargetOptions();
      await renderMonthlyTargetMonthOptions();
      await renderMonthlySummary();
      alert("通常利用を保存しました。");
      showView("home-view");
    } catch (error) {
      console.error("保存処理エラー:", error);
      alert(`保存失敗の詳細: ${error.message}`);
    }
  });
}

function setupSupportForm() {
  const supportForm = document.getElementById("support-form");
  if (!supportForm) throw new Error("support-form を取得できませんでした。");

  supportForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      if (!db) throw new Error("DBが初期化されていません。");

      const formData = new FormData(supportForm);
      const targetDetailId = String(formData.get("targetDetail") || "").trim();
      const targetDetail = parentDetailOptions.find((detail) => detail.detail_id === targetDetailId);

      const supportRecord = {
        support_id: createRecordId("support"),
        target_detail_id: targetDetailId,
        target_month: targetDetail ? String(targetDetail.target_month || "").trim() : "",
        target_purpose: targetDetail ? String(targetDetail.purpose || "").trim() : "",
        support_amount: Number(normalizeMoneyInput(formData.get("supportAmount"))),
        support_date: String(formData.get("supportDate") || "").trim(),
        note: String(formData.get("supportNote") || "").trim(),
        created_at: new Date().toISOString(),
        synced: false,
      };

      const validationMessage = validateSupportRecord(supportRecord);
      if (validationMessage) {
        alert(validationMessage);
        return;
      }

      await saveSupportRecord(supportRecord);
      supportForm.reset();
      syncDateUiReset("support-date-input", "support-date-display");
      await refreshHomeAndUnsyncedView();
      await renderSupportTargetOptions();
      await renderReserveTargetOptions();
      await renderMonthlyTargetMonthOptions();
      await renderMonthlySummary();
      alert("支援金を保存しました。");
      showView("home-view");
    } catch (error) {
      console.error("支援金保存エラー:", error);
      alert(`保存失敗の詳細: ${error.message}`);
    }
  });
}

function setupReserveForm() {
  const reserveForm = document.getElementById("reserve-form");
  if (!reserveForm) throw new Error("reserve-form を取得できませんでした。");

  reserveForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      if (!db) throw new Error("DBが初期化されていません。");

      const formData = new FormData(reserveForm);
      const targetDetailId = String(formData.get("targetReserveDetail") || "").trim();
      const targetDetail = parentDetailOptions.find((detail) => detail.detail_id === targetDetailId);

      const reserveRecord = {
        reserve_id: createRecordId("reserve"),
        target_detail_id: targetDetailId,
        target_month: targetDetail ? String(targetDetail.target_month || "").trim() : "",
        target_purpose: targetDetail ? String(targetDetail.purpose || "").trim() : "",
        reserve_amount: Number(normalizeMoneyInput(formData.get("reserveAmount"))),
        reserve_date: String(formData.get("reserveDate") || "").trim(),
        note: String(formData.get("reserveNote") || "").trim(),
        created_at: new Date().toISOString(),
        synced: false,
      };

      const validationMessage = validateReserveRecord(reserveRecord);
      if (validationMessage) {
        alert(validationMessage);
        return;
      }

      await saveReserveRecord(reserveRecord);
      reserveForm.reset();
      syncDateUiReset("reserve-date-input", "reserve-date-display");
      await refreshHomeAndUnsyncedView();
      await renderSupportTargetOptions();
      await renderReserveTargetOptions();
      await renderMonthlyTargetMonthOptions();
      await renderMonthlySummary();
      alert("準備金を保存しました。");
      showView("home-view");
    } catch (error) {
      console.error("準備金保存エラー:", error);
      alert(`保存失敗の詳細: ${error.message}`);
    }
  });
}

function syncDateUiReset(inputId, displayId) {
  const input = document.getElementById(inputId);
  const display = document.getElementById(displayId);
  if (!input || !display) return;

  input.value = "";
  display.textContent = "日付を選択してください";
  display.classList.add("placeholder");
}

function setupExportButton() {
  const exportButton = document.getElementById("export-json-button");
  if (!exportButton) throw new Error("export-json-button を取得できませんでした。");

  exportButton.addEventListener("click", async () => {
    try {
      const exportData = await buildUnsyncedExportData();
      const totalCount =
        exportData.details.length + exportData.supports.length + exportData.reserves.length;

      if (totalCount === 0) {
        alert("未同期データがありません。");
        return;
      }

      downloadJsonFile(exportData, createExportFileName());
      alert("未同期データをJSONで書き出しました。");
    } catch (error) {
      console.error("JSON書き出しエラー:", error);
      alert(`JSON書き出しに失敗しました: ${error.message}`);
    }
  });
}

function setupMonthlyTargetMonthSelector() {
  const monthSelect = document.getElementById("monthly-target-month");
  if (!monthSelect) throw new Error("monthly-target-month を取得できませんでした。");

  monthSelect.addEventListener("change", async () => {
    await renderMonthlySummary();
  });
}

async function buildUnsyncedExportData() {
  const details = await getUnsyncedDetails();
  const supports = await getUnsyncedRecords(SUPPORT_STORE);
  const reserves = await getUnsyncedRecords(RESERVE_STORE);

  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    details,
    supports,
    reserves,
  };
}

function downloadJsonFile(dataObject, fileName) {
  const jsonText = JSON.stringify(dataObject, null, 2);
  const blob = new Blob([jsonText], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
}

function createExportFileName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `credit_card_unsynced_${year}${month}${day}_${hours}${minutes}${seconds}.json`;
}

function getUnsyncedRecords(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error(`getUnsyncedRecords実行時にDBがnullです: ${storeName}`));
      return;
    }

    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => {
      const allRecords = request.result || [];
      const unsyncedRecords = allRecords
        .filter((record) => record.synced === false)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      resolve(unsyncedRecords);
    };

    request.onerror = () => reject(new Error(`${storeName} の未同期データ取得に失敗しました。`));
  });
}

async function renderMonthlyTargetMonthOptions() {
  const monthSelect = document.getElementById("monthly-target-month");
  if (!monthSelect) return;

  const currentValue = monthSelect.value;
  const monthItems = await fetchMonthlyOptions();

  monthSelect.innerHTML = "";

  if (monthItems.length === 0) {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "対象月がありません";
    monthSelect.appendChild(emptyOption);
    return;
  }

  monthItems.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.target_month;
    option.textContent = item.target_month;
    monthSelect.appendChild(option);
  });

  const monthValues = monthItems.map((item) => item.target_month);
  if (monthValues.includes(currentValue)) {
    monthSelect.value = currentValue;
  } else {
    monthSelect.value = monthValues[0];
  }
}

async function renderMonthlySummary() {
  const monthSelect = document.getElementById("monthly-target-month");
  if (!monthSelect) return;

  const targetMonth = monthSelect.value;
  const balanceElement = document.getElementById("monthly-balance");

  if (!targetMonth) {
    updateMonthlySummaryDisplay({
      detailTotal: null,
      supportTotal: null,
      reserveTotal: null,
    });
    updateMonthlyCountDisplay({
      detailCount: 0,
      supportCount: 0,
      reserveCount: 0,
    });
    renderMonthlyCardBreakdown([]);
    renderMonthlyBudgetBreakdown([]);
    renderMonthlySupportList([]);
    renderMonthlyReserveList([]);
    if (balanceElement) balanceElement.textContent = "未取得";
    return;
  }

  const financials = await fetchMonthlyFinancials(targetMonth);

  updateMonthlySummaryDisplay({
    detailTotal: financials.card,
    supportTotal: financials.support,
    reserveTotal: financials.reserve,
  });

  if (balanceElement) {
    balanceElement.textContent =
      financials.balance === null ? "未取得" : formatCurrency(financials.balance);
  }

  updateMonthlyCountDisplay({
    detailCount: 0,
    supportCount: 0,
    reserveCount: 0,
  });

  renderMonthlyCardBreakdown(
    financials.card === null ? [] : [{ cardName: "親ファイル集計", amount: financials.card }]
  );

  renderMonthlyBudgetBreakdown([]);

  renderMonthlySupportList(
    financials.support === null
      ? []
      : [{ target_purpose: "親ファイル集計", support_amount: financials.support }]
  );

  renderMonthlyReserveList(
    financials.reserve === null
      ? []
      : [{ target_purpose: "親ファイル集計", reserve_amount: financials.reserve }]
  );
}

function renderMonthlyCardBreakdown(cardBreakdown) {
  const listElement = document.getElementById("monthly-card-breakdown");
  if (!listElement) return;

  if (cardBreakdown.length === 0) {
    listElement.innerHTML = '<p class="empty-message">対象月のカード利用はありません。</p>';
    return;
  }

  listElement.innerHTML = cardBreakdown
    .map(
      (item) => `
        <div class="monthly-row">
          <span class="monthly-row-label">${escapeHtml(item.cardName)}</span>
          <span class="monthly-row-value">${formatCurrency(item.amount)}</span>
        </div>
      `
    )
    .join("");
}

function renderMonthlyBudgetBreakdown(budgetBreakdown) {
  const listElement = document.getElementById("monthly-budget-breakdown");
  if (!listElement) return;

  if (budgetBreakdown.length === 0) {
    listElement.innerHTML = '<p class="empty-message">対象月の分類別データはありません。</p>';
    return;
  }

  listElement.innerHTML = budgetBreakdown
    .map(
      (item) => `
        <div class="monthly-row">
          <span class="monthly-row-label">${escapeHtml(item.categoryName)}</span>
          <span class="monthly-row-value">${formatCurrency(item.amount)}</span>
        </div>
      `
    )
    .join("");
}

function renderMonthlySupportList(supportRecords) {
  const listElement = document.getElementById("monthly-support-list");
  if (!listElement) return;

  if (supportRecords.length === 0) {
    listElement.innerHTML = '<p class="empty-message">対象月の支援金はありません。</p>';
    return;
  }

  listElement.innerHTML = supportRecords
    .map(
      (record) => `
        <div class="monthly-row">
          <span class="monthly-row-label">${escapeHtml(record.target_purpose || "用途未設定")}</span>
          <span class="monthly-row-value">${formatCurrency(record.support_amount)}</span>
        </div>
      `
    )
    .join("");
}

function renderMonthlyReserveList(reserveRecords) {
  const listElement = document.getElementById("monthly-reserve-list");
  if (!listElement) return;

  if (reserveRecords.length === 0) {
    listElement.innerHTML = '<p class="empty-message">対象月の準備金はありません。</p>';
    return;
  }

  listElement.innerHTML = reserveRecords
    .map(
      (record) => `
        <div class="monthly-row">
          <span class="monthly-row-label">${escapeHtml(record.target_purpose || "用途未設定")}</span>
          <span class="monthly-row-value">${formatCurrency(record.reserve_amount)}</span>
        </div>
      `
    )
    .join("");
}

function updateMonthlySummaryDisplay(summary) {
  document.getElementById("monthly-total-detail").textContent =
    summary.detailTotal === null ? "未取得" : formatCurrency(summary.detailTotal);
  document.getElementById("monthly-total-support").textContent =
    summary.supportTotal === null ? "未取得" : formatCurrency(summary.supportTotal);
  document.getElementById("monthly-total-reserve").textContent =
    summary.reserveTotal === null ? "未取得" : formatCurrency(summary.reserveTotal);
}

function updateMonthlyCountDisplay(counts) {
  document.getElementById("monthly-detail-count").textContent = String(counts.detailCount);
  document.getElementById("monthly-support-count").textContent = String(counts.supportCount);
  document.getElementById("monthly-reserve-count").textContent = String(counts.reserveCount);
}

function normalizeTargetMonth(dateValue) {
  const text = String(dateValue || "").trim();
  if (!text) return "";
  const parts = text.split("-");
  if (parts.length !== 3) return "";
  const year = parts[0];
  const month = parts[1];
  if (year.length !== 4 || month.length !== 2) return "";
  return `${year}-${month}`;
}

function validateDetailRecord(detailRecord) {
  if (!detailRecord.use_date) return "利用日を入力してください。";
  if (!detailRecord.amount || detailRecord.amount <= 0) return "利用金額は0より大きい数値を入力してください。";
  if (!detailRecord.purpose) return "利用用途を入力してください。";
  if (!detailRecord.budget_category) return "予算分類を選択してください。";
  if (!detailRecord.card_name) return "利用カードを選択してください。";
  if (!detailRecord.target_month) return "利用日から対象月を作成できませんでした。";
  return "";
}

function validateSupportRecord(supportRecord) {
  if (!supportRecord.target_detail_id) return "対象明細を選択してください。";
  if (!supportRecord.support_amount || supportRecord.support_amount <= 0) return "支援金額は0より大きい数値を入力してください。";
  if (!supportRecord.support_date) return "登録日を入力してください。";
  if (!supportRecord.target_month) return "対象明細の対象月を取得できませんでした。";
  return "";
}

function validateReserveRecord(reserveRecord) {
  if (!reserveRecord.target_detail_id) return "対象明細を選択してください。";
  if (!reserveRecord.reserve_amount || reserveRecord.reserve_amount <= 0) return "準備金額は0より大きい数値を入力してください。";
  if (!reserveRecord.reserve_date) return "登録日を入力してください。";
  if (!reserveRecord.target_month) return "対象明細の対象月を取得できませんでした。";
  return "";
}

function saveDetailRecord(detailRecord) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("saveDetailRecord実行時にDBがnullです。"));
      return;
    }

    const transaction = db.transaction([DETAIL_STORE], "readwrite");
    const store = transaction.objectStore(DETAIL_STORE);
    const request = store.add(detailRecord);

    transaction.onerror = () => reject(new Error(`transaction失敗: ${transaction.error?.message || "unknown error"}`));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`明細保存に失敗しました: ${request.error?.message || "unknown error"}`));
  });
}

function saveSupportRecord(supportRecord) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("saveSupportRecord実行時にDBがnullです。"));
      return;
    }

    const transaction = db.transaction([SUPPORT_STORE], "readwrite");
    const store = transaction.objectStore(SUPPORT_STORE);
    const request = store.add(supportRecord);

    transaction.onerror = () => reject(new Error(`transaction失敗: ${transaction.error?.message || "unknown error"}`));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`支援金保存に失敗しました: ${request.error?.message || "unknown error"}`));
  });
}

function saveReserveRecord(reserveRecord) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("saveReserveRecord実行時にDBがnullです。"));
      return;
    }

    const transaction = db.transaction([RESERVE_STORE], "readwrite");
    const store = transaction.objectStore(RESERVE_STORE);
    const request = store.add(reserveRecord);

    transaction.onerror = () => reject(new Error(`transaction失敗: ${transaction.error?.message || "unknown error"}`));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`準備金保存に失敗しました: ${request.error?.message || "unknown error"}`));
  });
}

function countUnsyncedRecords(storeName) {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error(`countUnsyncedRecords実行時にDBがnullです: ${storeName}`));
      return;
    }

    const transaction = db.transaction([storeName], "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.openCursor();
    let count = 0;

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value && cursor.value.synced === false) count += 1;
        cursor.continue();
      } else {
        resolve(count);
      }
    };

    request.onerror = () => reject(new Error(`${storeName} の未同期件数取得に失敗しました。`));
  });
}

function getUnsyncedDetails() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("getUnsyncedDetails実行時にDBがnullです。"));
      return;
    }

    const transaction = db.transaction([DETAIL_STORE], "readonly");
    const store = transaction.objectStore(DETAIL_STORE);
    const request = store.getAll();

    request.onsuccess = () => {
      const allDetails = request.result || [];
      const unsyncedDetails = allDetails
        .filter((detail) => detail.synced === false)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      resolve(unsyncedDetails);
    };

    request.onerror = () => reject(new Error("未同期明細の取得に失敗しました。"));
  });
}

async function renderUnsyncedCounts() {
  const detailCount = await countUnsyncedRecords(DETAIL_STORE);
  const supportCount = await countUnsyncedRecords(SUPPORT_STORE);
  const reserveCount = await countUnsyncedRecords(RESERVE_STORE);

  document.getElementById("unsynced-detail-count").textContent = detailCount;
  document.getElementById("unsynced-support-count").textContent = supportCount;
  document.getElementById("unsynced-reserve-count").textContent = reserveCount;
}

async function renderUnsyncedDetailList() {
  const listElement = document.getElementById("unsynced-detail-list");
  if (!listElement) return;

  try {
    const unsyncedDetails = await getUnsyncedDetails();

    if (unsyncedDetails.length === 0) {
      listElement.innerHTML = '<p class="empty-message">未同期明細はありません。</p>';
      return;
    }

    listElement.innerHTML = unsyncedDetails
      .map(
        (detail) => `
          <div class="record-card">
            <div class="record-card-top">
              <span class="record-date">${escapeHtml(detail.use_date || "")}</span>
              <span class="record-amount">${formatCurrency(detail.amount)}</span>
            </div>
            <div class="record-purpose">${escapeHtml(detail.purpose || "")}</div>
            <div class="record-meta">
              <span class="meta-chip">${escapeHtml(detail.budget_category || "")}</span>
              <span class="meta-chip">${escapeHtml(detail.card_name || "")}</span>
              <span class="meta-chip">${escapeHtml(detail.target_month || "")}</span>
            </div>
          </div>
        `
      )
      .join("");
  } catch (error) {
    console.error(error);
    listElement.innerHTML = `<p class="empty-message">一覧取得に失敗しました: ${escapeHtml(error.message)}</p>`;
  }
}

function buildParentDetailOptionLabel(detail) {
  const useDate = String(detail.use_date || "").trim();
  const purpose = String(detail.purpose || "").trim();
  const amount = formatCurrency(detail.amount || 0);
  const cardName = String(detail.card_name || "").trim();
  return `${useDate} | ${purpose} | ${amount} | ${cardName}`;
}

function filterParentDetailsByMonth(targetMonth) {
  const normalized = String(targetMonth || "").trim();
  if (!normalized) return [];
  return parentDetailOptions.filter((detail) => String(detail.target_month || "").trim() === normalized);
}

async function renderSupportTargetOptions() {
  const targetSelect = document.querySelector('select[name="targetDetail"]');
  const monthSelect = document.getElementById("support-target-month");
  if (!targetSelect || !monthSelect) return;

  const targetMonth = String(monthSelect.value || "").trim();
  targetSelect.innerHTML = "";

  if (!targetMonth) {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "対象月を選択してください";
    targetSelect.appendChild(emptyOption);
    return;
  }

  const filteredDetails = filterParentDetailsByMonth(targetMonth);

  if (filteredDetails.length === 0) {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "対象明細がありません";
    targetSelect.appendChild(emptyOption);
    return;
  }

  const firstOption = document.createElement("option");
  firstOption.value = "";
  firstOption.textContent = "選択してください";
  targetSelect.appendChild(firstOption);

  filteredDetails.forEach((detail) => {
    const option = document.createElement("option");
    option.value = detail.detail_id;
    option.textContent = buildParentDetailOptionLabel(detail);
    targetSelect.appendChild(option);
  });
}

async function renderReserveTargetOptions() {
  const targetSelect = document.querySelector('select[name="targetReserveDetail"]');
  const monthSelect = document.getElementById("reserve-target-month");
  if (!targetSelect || !monthSelect) return;

  const targetMonth = String(monthSelect.value || "").trim();
  targetSelect.innerHTML = "";

  if (!targetMonth) {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "対象月を選択してください";
    targetSelect.appendChild(emptyOption);
    return;
  }

  const filteredDetails = filterParentDetailsByMonth(targetMonth);

  if (filteredDetails.length === 0) {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "対象明細がありません";
    targetSelect.appendChild(emptyOption);
    return;
  }

  const firstOption = document.createElement("option");
  firstOption.value = "";
  firstOption.textContent = "選択してください";
  targetSelect.appendChild(firstOption);

  filteredDetails.forEach((detail) => {
    const option = document.createElement("option");
    option.value = detail.detail_id;
    option.textContent = buildParentDetailOptionLabel(detail);
    targetSelect.appendChild(option);
  });
}

async function refreshHomeAndUnsyncedView() {
  await renderUnsyncedCounts();
  await renderUnsyncedDetailList();
}

function formatCurrency(value) {
  const numberValue = Number(value || 0);
  return `¥${numberValue.toLocaleString("ja-JP")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createRecordId(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`;
}