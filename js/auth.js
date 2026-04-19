// ============================================================
// TENERIFE GLOW RITUAL — Auth & User Flow (FIXED)
// ============================================================

const db = window.supabaseClient;

// ── AUTH STATE ─────────────────────────────────────────────

db.auth.onAuthStateChange(async function (event, session) {
  if (event === "SIGNED_IN" && session?.user) {
    try {
      await ensureUserProfile(session.user);
    } catch (err) {
      console.error("Error ensuring user profile:", err);
    }
  }
});

// ── HELPERS ────────────────────────────────────────────────

function currentPageName() {
  return window.location.pathname.split("/").pop() || "index.html";
}

async function ensureOnboardingRow(userId) {
  const { data: existing, error } = await db
    .from("onboarding")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error checking onboarding row:", error.message);
    return;
  }

  if (!existing) {
    const { error: insertError } = await db.from("onboarding").insert({
      user_id: userId,
      onboarding_complete: false,
      partner_complete: false
    });

    if (insertError) {
      console.error("Error creating onboarding row:", insertError.message);
    }
  }
}

// ── ENSURE USER PROFILE EXISTS ────────────────────────────

async function ensureUserProfile(user) {
  const { data: existing, error } = await db
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error checking existing user:", error.message);
    return;
  }

  if (!existing) {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      "";
    const email = user.email || "";

    const { error: insertUserError } = await db.from("users").insert({
      id: user.id,
      full_name: fullName,
      email: email,
      preferred_lang: localStorage.getItem("tgr-language") || "es"
    });

    if (insertUserError) {
      console.error("Error creating user profile:", insertUserError.message);
      return;
    }
  }

  await ensureOnboardingRow(user.id);
}

// ── CHECK SESSION ─────────────────────────────────────────

async function checkSession() {
  const {
    data: { session }
  } = await db.auth.getSession();

  const publicPages = ["index.html", "login.html", "signup.html", "products.html"];
  const currentPage = currentPageName();
  const isPublicPage = publicPages.includes(currentPage);

  if (!session && !isPublicPage) {
    window.location.href = "login.html";
    return null;
  }

  if (session && (currentPage === "login.html" || currentPage === "signup.html")) {
    await redirectByOnboardingStatus(session.user.id);
    return session;
  }

  return session;
}

// ── REDIRECT BY STATUS ────────────────────────────────────

async function redirectByOnboardingStatus(userId) {
  const { data: onboarding, error } = await db
    .from("onboarding")
    .select("onboarding_complete, partner_complete")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error loading onboarding status:", error.message);
    window.location.href = "dashboard.html";
    return;
  }

  if (!onboarding) {
    await ensureOnboardingRow(userId);
    window.location.href = "dashboard.html";
    return;
  }

  if (!onboarding.partner_complete) {
    window.location.href = "dashboard.html";
    return;
  }

  if (onboarding.partner_complete && !onboarding.onboarding_complete) {
    window.location.href = "onboarding.html";
    return;
  }

  window.location.href = "dashboard.html";
}

// ── SIGN UP ───────────────────────────────────────────────

async function signUp(fullName, email, password, skinGoal) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        name: fullName,
        skin_goal: skinGoal || ""
      }
    }
  });

  if (error) {
    showError(error.message);
    return { ok: false, error: error.message };
  }

  if (data?.user) {
    await ensureUserProfile({
      ...data.user,
      user_metadata: {
        ...data.user.user_metadata,
        full_name: fullName,
        name: fullName
      }
    });
    
    // FIXED: Small delay to ensure profile is fully created in the database
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { ok: true, user: data?.user || null };
}

// ── LOG IN ────────────────────────────────────────────────

async function logIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    showError(error.message);
    return { ok: false, error: error.message };
  }

  if (data?.user) {
    await ensureUserProfile(data.user);
    await redirectByOnboardingStatus(data.user.id);
    return { ok: true, user: data.user };
  }

  return { ok: false, error: "No user returned from login." };
}

// ── LOG OUT ───────────────────────────────────────────────

async function logOut() {
  console.log("Logout initiated");
  try {
    console.log("Calling db.auth.signOut()...");
    const result = await db.auth.signOut();
    console.log("signOut result:", result);

    if (result?.error) {
      console.error("Supabase signOut error:", result.error.message);
    } else {
      console.log("Successfully signed out");
    }
  } catch (err) {
    console.error("Logout catch error:", err);
  } finally {
    console.log("In finally block, removing localStorage");
    localStorage.removeItem("tgr-language");
    
    console.log("Setting timeout for redirect");
    setTimeout(() => {
      console.log("Timeout fired - redirecting to home page");
      window.location.href = "index.html";
    }, 200);
  }
}

// ── SAVE ONBOARDING ───────────────────────────────────────

async function saveOnboarding(formData) {
  const {
    data: { session }
  } = await db.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const userId = session.user.id;

  await db.from("skin_analysis").upsert(
    {
      user_id: userId,
      skin_type: formData.skinType,
      skin_concern: formData.skinConcern,
      goal: formData.goal,
      sensitivity: formData.sensitivity,
      notes: formData.notes
    },
    { onConflict: "user_id" }
  );

  if (formData.productName || formData.orderReference || formData.purchaseDate) {
    await db.from("purchases").insert({
      user_id: userId,
      product_name: formData.productName || null,
      order_reference: formData.orderReference || null,
      purchase_date: formData.purchaseDate || null,
      amount_paid: formData.amountPaid
        ? parseFloat(String(formData.amountPaid).replace(",", "."))
        : null,
      confirmed: !!formData.purchaseConfirmed
    });
  }

  await db.from("onboarding").upsert(
    {
      user_id: userId,
      daily_minutes: formData.time ? parseInt(formData.time, 10) : null,
      routine_level: formData.level || null,
      ritual_duration: formData.timeline ? parseInt(formData.timeline, 10) : 90,
      current_routine: formData.currentRoutine || null,
      additional_notes: formData.notes || null,
      onboarding_complete: true,
      partner_complete: true,
      completed_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  window.location.href = "dashboard.html";
}

// ── COMPLETE RITUAL DAY ───────────────────────────────────

async function completeRitualDay(notes = "") {
  const {
    data: { session }
  } = await db.auth.getSession();

  if (!session) return false;

  const today = new Date().toISOString().split("T")[0];

  const { error } = await db.from("ritual_calendar").upsert(
    {
      user_id: session.user.id,
      completed_date: today,
      notes
    },
    { onConflict: "user_id,completed_date" }
  );

  if (error) {
    console.error("Error completing ritual day:", error.message);
    return false;
  }

  return true;
}

// ── LOAD DASHBOARD DATA ───────────────────────────────────

async function loadDashboardData() {
  const {
    data: { session }
  } = await db.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return null;
  }

  const userId = session.user.id;

  let [userRes, skinRes, onboardRes, purchaseRes, calendarRes, rewardsRes] = await Promise.all([
    db.from("users").select("*").eq("id", userId).maybeSingle(),
    db.from("skin_analysis").select("*").eq("user_id", userId).maybeSingle(),
    db.from("onboarding").select("*").eq("user_id", userId).maybeSingle(),
    db
      .from("purchases")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("ritual_calendar")
      .select("completed_date")
      .eq("user_id", userId)
      .order("completed_date", { ascending: false }),
    db.from("user_rewards").select("*, rewards(*)").eq("user_id", userId)
  ]);

  if (!userRes.data) {
    await ensureUserProfile(session.user);
    userRes = await db.from("users").select("*").eq("id", userId).maybeSingle();
  }

  if (!onboardRes.data) {
    await ensureOnboardingRow(userId);
    onboardRes = await db.from("onboarding").select("*").eq("user_id", userId).maybeSingle();
  }

  const completedDates = (calendarRes.data || []).map((r) => r.completed_date);
  const daysCompleted = completedDates.length;
  const streak = calculateStreak(completedDates);

  return {
    user: userRes.data || {
      full_name: session.user.user_metadata?.full_name || "",
      email: session.user.email || "",
      preferred_lang: localStorage.getItem("tgr-language") || "es"
    },
    skinAnalysis: skinRes.data || null,
    onboarding: onboardRes.data || null,
    purchase: purchaseRes.data || null,
    completedDates,
    daysCompleted,
    streak,
    rewards: rewardsRes.data || []
  };
}

// ── CALCULATE STREAK ──────────────────────────────────────

function calculateStreak(dates) {
  if (!dates || dates.length === 0) return 0;

  const sorted = [...dates].sort((a, b) => new Date(b) - new Date(a));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let check = new Date(today);

  for (const dateStr of sorted) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);

    if (d.getTime() === check.getTime()) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// ── SHOW ERROR ────────────────────────────────────────────

function showError(message) {
  const existing = document.getElementById("tgr-error");
  if (existing) existing.remove();

  const div = document.createElement("div");
  div.id = "tgr-error";
  div.style.cssText =
    "background:#fee;border:1px solid #fcc;color:#900;padding:12px 16px;margin-bottom:1rem;font-size:13px;line-height:1.5;";
  div.textContent = message;

  const form = document.querySelector("form");
  if (form) form.prepend(div);
}

// ── EXPOSE GLOBALLY ───────────────────────────────────────

window.tgr = {
  checkSession,
  signUp,
  logIn,
  logOut,
  saveOnboarding,
  completeRitualDay,
  loadDashboardData,
  calculateStreak,
  ensureUserProfile
};
