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
    
    // Small delay to ensure profile is fully created in the database
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // FIXED: Redirect to dashboard after successful sign-up
    await redirectByOnboardingStatus(data.user.id);
  }

  return { ok: true, user: data?.user || null };
}

// ── LOG IN ────────────────────────────────────────────────

function logIn(email, password) {
  console.log("Login initiated with:", email);
  
  db.auth.signInWithPassword({ email, password })
    .then(({ data, error }) => {
      if (error) {
        console.error("Login error:", error.message);
        showError(error.message);
        return;
      }

      if (data?.user) {
        console.log("User logged in successfully");
        localStorage.setItem("tgr-user", JSON.stringify(data.user));
        
        // Go directly to dashboard without checking status
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 300);
      }
    })
    .catch(err => {
      console.error("Login error:", err);
      showError(err.message || "Login failed");
    });
}

// ── LOG OUT ───────────────────────────────────────────────

function logOut() {
  console.log("Logout initiated");
  
  // Clear the session without waiting for Supabase response
  localStorage.removeItem("tgr-language");
  localStorage.clear();
  
  // Sign out in the background (don't wait for it)
  db.auth.signOut().catch(err => console.error("SignOut error:", err));
  
  // Redirect immediately
  setTimeout(() => {
    console.log("Redirecting to home page");
    window.location.href = "index.html";
  }, 100);
}



// ── SAVE ONBOARDING ───────────────────────────────────────

function saveOnboarding(formData) {
  console.log("saveOnboarding called with:", formData);
  
  const getSession = async () => {
    const {
      data: { session }
    } = await db.auth.getSession();
    return session;
  };

  getSession().then(session => {
    if (!session) {
      console.log("No session, redirecting to login");
      window.location.href = "login.html";
      return;
    }

    const userId = session.user.id;
    console.log("Saving onboarding for user:", userId);

    // Save skin analysis
    db.from("skin_analysis").upsert(
      {
        user_id: userId,
        skin_type: formData.skinType,
        skin_concern: formData.skinConcern,
        goal: formData.goal,
        sensitivity: formData.sensitivity,
        notes: formData.notes
      },
      { onConflict: "user_id" }
    ).catch(err => console.error("Skin analysis error:", err));

    // Save purchase
    if (formData.productName || formData.orderReference || formData.purchaseDate) {
      db.from("purchases").insert({
        user_id: userId,
        product_name: formData.productName || null,
        order_reference: formData.orderReference || null,
        purchase_date: formData.purchaseDate || null,
        amount_paid: formData.amountPaid
          ? parseFloat(String(formData.amountPaid).replace(",", ".").replace("£", "").replace("€", ""))
          : null,
        confirmed: !!formData.purchaseConfirmed
      }).catch(err => console.error("Purchase error:", err));
    }

    // Save onboarding and redirect
    db.from("onboarding").upsert(
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
    ).then(() => {
      console.log("Onboarding saved successfully");
      setTimeout(() => {
        console.log("Redirecting to dashboard");
        window.location.href = "dashboard.html";
      }, 500);
    }).catch(err => console.error("Onboarding error:", err));
  });
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
