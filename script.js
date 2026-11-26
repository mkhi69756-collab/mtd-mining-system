
'use strict';

/* =========================================
   MTD MINING FRONTEND
========================================= */

const API_URL =
  "https://mtd-mining-backend-2026.mkhi69756.workers.dev";

const tg = window.Telegram?.WebApp;

const $ = id => document.getElementById(id);

let isRegistering = false;
let isVerifying = false;
let isClaiming = false;
let isStarting = false;

/* =========================================
   MESSAGE
========================================= */

function showMessage(text) {
  const box = $("message");
  if (!box) return;

  box.textContent = text;
  box.classList.remove("hidden");
}

function hideMessage() {
  $("message")?.classList.add("hidden");
}

function showSection(id) {
  [
    "registerSection",
    "pendingSection",
    "dashboardSection"
  ].forEach(section => {
    $(section)?.classList.add("hidden");
  });

  $(id)?.classList.remove("hidden");
}

/* =========================================
   TELEGRAM
========================================= */

function initializeTelegram() {
  if (!tg || !tg.initData) {
    showSection("registerSection");
    showMessage("Please open this app through Telegram.");
    return false;
  }

  tg.ready();
  tg.expand();

  const user = tg.initDataUnsafe?.user;

  if (user && $("userName")) {
    $("userName").textContent =
      [user.first_name, user.last_name]
        .filter(Boolean)
        .join(" ") || "MTD Miner";
  }

  const startParam =
    tg.initDataUnsafe?.start_param || "";

  if (startParam.startsWith("ref_")) {
    const input = $("referralCode");

    if (input) {
      input.value = startParam.substring(4);
    }
  }

  return true;
}

/* =========================================
   API
========================================= */

async function api(path, method = "GET", body = null) {
  if (!tg?.initData) {
    throw new Error("Telegram authentication missing.");
  }

  const options = {
    method,
    headers: {
      "Authorization": "Bearer " + tg.initData,
      "Content-Type": "application/json"
    }
  };

  if (body !== null) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(API_URL + path, options);

  let data;

  try {
    data = await res.json();
  } catch {
    throw new Error("Invalid server response.");
  }

  if (!res.ok || data.success !== true) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

/* =========================================
   REGISTER
========================================= */

async function registerUser(event) {
  event.preventDefault();

  if (isRegistering) return;

  hideMessage();

  const fullName = $("fullName")?.value.trim();
  const email = $("email")?.value.trim().toLowerCase();
  const referralCode = $("referralCode")?.value.trim() || "";

  if (!fullName) {
    showMessage("Please enter your full name.");
    return;
  }

  if (!email) {
    showMessage("Please enter your email.");
    return;
  }

  const button = $("registerBtn");

  isRegistering = true;

  if (button) {
    button.disabled = true;
    button.textContent = "SENDING OTP...";
  }

  try {
    const result = await api(
      "/api/register",
      "POST",
      {
        full_name: fullName,
        email,
        referral_code: referralCode
      }
    );

    localStorage.setItem("mtd_pending", "yes");
    localStorage.setItem("mtd_pending_email", email);

    showSection("pendingSection");

    $("otp")?.focus();

    showMessage(
      result.message || "OTP sent to your email."
    );

  } catch (error) {
    showMessage(error.message);

  } finally {
    isRegistering = false;

    if (button) {
      button.disabled = false;
      button.textContent = "REGISTER NOW";
    }
  }
}

/* =========================================
   VERIFY OTP
========================================= */

async function verifyOTP(event) {
  event.preventDefault();

  if (isVerifying) return;

  hideMessage();

  const otp = $("otp")?.value.trim();

  if (!/^\d{6}$/.test(otp || "")) {
    showMessage("Please enter a valid 6-digit OTP.");
    return;
  }

  const button = $("verifyBtn");

  isVerifying = true;

  if (button) {
    button.disabled = true;
    button.textContent = "VERIFYING...";
  }

  try {
    const result = await api(
      "/api/verify-otp",
      "POST",
      { otp }
    );

    localStorage.removeItem("mtd_pending");
    localStorage.removeItem("mtd_pending_email");

    showMessage(
      result.message || "Registration successful!"
    );

    await refreshProfile(true);

  } catch (error) {
    showMessage(error.message);

  } finally {
    isVerifying = false;

    if (button) {
      button.disabled = false;
      button.textContent = "VERIFY OTP";
    }
  }
}

/* =========================================
   RESEND OTP
========================================= */

async function resendOTP() {
  const button = $("resendBtn");

  if (button) {
    button.disabled = true;
    button.textContent = "SENDING...";
  }

  try {
    const result = await api(
      "/api/resend-otp",
      "POST",
      {}
    );

    showMessage(
      result.message || "New OTP sent."
    );

  } catch (error) {
    showMessage(error.message);

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "RESEND OTP";
    }
  }
}

/* =========================================
   PROFILE
========================================= */

async function refreshProfile(keepMessage = false) {
  if (!keepMessage) hideMessage();

  try {
    const result = await api("/api/user");
    const user = result.user;

    if (!user) {
      throw new Error("User profile not found.");
    }

    localStorage.removeItem("mtd_pending");
    localStorage.removeItem("mtd_pending_email");

    if ($("userName")) {
      $("userName").textContent =
        user.full_name || "MTD Miner";
    }

    if ($("balance")) {
      $("balance").textContent =
        Number(user.balance || 0).toFixed(4) + " MTD";
    }

    if ($("totalMined")) {
      $("totalMined").textContent =
        Number(user.total_mined || 0).toFixed(4) + " MTD";
    }

    if ($("miningStatus")) {
      $("miningStatus").textContent =
        user.mining_active ? "ACTIVE" : "STOPPED";
    }

    if ($("referralCodeDisplay")) {
      $("referralCodeDisplay").textContent =
        user.referral_code || "Not available";
    }

    updateMiningStatus(user);
    showSection("dashboardSection");

    await loadHistory();

  } catch (error) {
    if (localStorage.getItem("mtd_pending") === "yes") {
      showSection("pendingSection");
    } else {
      showSection("registerSection");
    }

    if (!keepMessage) {
      showMessage(error.message);
    }
  }
}

/* =========================================
   MINING STATUS
========================================= */

function updateMiningStatus(user) {
  const claimBtn = $("claimBtn");
  const startBtn = $("startMiningBtn");
  const nextClaim = $("nextClaim");

  if (!claimBtn || !nextClaim) return;

  if (!user.mining_active) {
    claimBtn.disabled = true;
    claimBtn.textContent = "MINING STOPPED";

    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = "START MINING";
      startBtn.classList.remove("hidden");
    }

    nextClaim.textContent =
      "Start mining first to unlock your reward.";

    return;
  }

  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = "MINING ACTIVE";
  }

  claimBtn.textContent = "CLAIM MINING REWARD";

  if (!user.last_claim_at) {
    claimBtn.disabled = false;
    nextClaim.textContent = "Your first claim is ready.";
    return;
  }

  const nextTime =
    Number(user.last_claim_at) + 86400;

  const remaining =
    nextTime - Math.floor(Date.now() / 1000);

  if (remaining > 0) {
    claimBtn.disabled = true;

    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);

    nextClaim.textContent =
      `Next claim available in ${hours}h ${minutes}m`;
  } else {
    claimBtn.disabled = false;
    nextClaim.textContent =
      "Your mining reward is ready to claim.";
  }
}

/* =========================================
   START MINING
========================================= */

async function startMining() {
  if (isStarting) return;

  const button = $("startMiningBtn");

  isStarting = true;

  if (button) {
    button.disabled = true;
    button.textContent = "STARTING...";
  }

  try {
    const result = await api(
      "/api/mining/start",
      "POST",
      {}
    );

    showMessage(result.message || "Mining started.");

    await refreshProfile(true);

  } catch (error) {
    showMessage(error.message);
    await refreshProfile(true);

  } finally {
    isStarting = false;
  }
}

/* =========================================
   CLAIM
========================================= */

async function claimMining() {
  if (isClaiming) return;

  const button = $("claimBtn");

  isClaiming = true;

  if (button) {
    button.disabled = true;
    button.textContent = "PROCESSING...";
  }

  try {
    const result = await api(
      "/api/mining/claim",
      "POST",
      {}
    );

    const reward =
      Number(result.reward || 0).toFixed(4);

    await refreshProfile(true);

    showMessage(
      `Successfully claimed ${reward} MTD!`
    );

  } catch (error) {
    showMessage(error.message);
    await refreshProfile(true);

  } finally {
    isClaiming = false;
  }
}

/* =========================================
   REFERRAL COPY
========================================= */

async function copyReferral() {
  const code =
    $("referralCodeDisplay")?.textContent?.trim();

  if (!code || code === "Loading..." || code === "Not available") {
    showMessage("Referral code is not available.");
    return;
  }

  try {
    await navigator.clipboard.writeText(code);
    showMessage("Referral code copied successfully.");
  } catch {
    showMessage("Please copy the code manually.");
  }
}

/* =========================================
   MINING HISTORY
========================================= */

async function loadHistory() {
  try {
    const result = await api("/api/mining/history");

    const list = $("historyList");

    if (!list) return;

    list.replaceChildren();

    const history =
      result.claims || result.history || [];

    if (!Array.isArray(history) || history.length === 0) {
      list.textContent = "No mining history yet.";
      return;
    }

    history.forEach(item => {
      const row = document.createElement("div");
      row.className = "history-item";

      const date = document.createElement("span");
      date.textContent =
        new Date(Number(item.claimed_at) * 1000)
          .toLocaleString();

      const amount = document.createElement("strong");
      amount.textContent =
        "+" + Number(item.reward || 0).toFixed(4) + " MTD";

      row.append(date, amount);
      list.appendChild(row);
    });

  } catch (error) {
    console.error("History error:", error);
  }
}

/* =========================================
   APP START
========================================= */

document.addEventListener("DOMContentLoaded", () => {
  if (!initializeTelegram()) return;

  $("registerForm")?.addEventListener(
    "submit",
    registerUser
  );

  $("otpForm")?.addEventListener(
    "submit",
    verifyOTP
  );

  $("resendBtn")?.addEventListener(
    "click",
    resendOTP
  );

  $("startMiningBtn")?.addEventListener(
    "click",
    startMining
  );

  $("claimBtn")?.addEventListener(
    "click",
    claimMining
  );

  $("copyReferral")?.addEventListener(
    "click",
    copyReferral
  );

  if (localStorage.getItem("mtd_pending") === "yes") {
    showSection("pendingSection");
  } else {
    showSection("registerSection");
  }

  refreshProfile();
});