// ============================================================
// TENERIFE GLOW RITUAL — Auth & User Flow
// ============================================================
// Handles login, signup, session checking, and redirects
// based on where the user is in their onboarding journey.
// ============================================================

const db = window.supabaseClient;

// ── CHECK SESSION ON EVERY PAGE LOAD ──────────────────────
// Call this at the top of every page to manage redirects.

async function checkSession() {
  const { data: { session } } = await db.auth.getSession();

  const publicPages = ['index.html', 'login.html', 'signup.html', 'products.html'];
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const isPublicPage = publicPages.includes(currentPage);

  if (!session && !isPublicPage) {
    // Not logged in and trying to access a protected page
    window.location.href = 'login.html';
    return null;
  }

  if (session && (currentPage === 'login.html' || currentPage === 'signup.html')) {
    // Already logged in — redirect away from auth pages
    await redirectByOnboardingStatus(session.user.id);
    return session;
  }

  return session;
}

// ── REDIRECT BASED ON ONBOARDING STATUS ───────────────────
// Checks the database and sends user to the right page.

async function redirectByOnboardingStatus(userId) {
  const { data: onboarding } = await db
    .from('onboarding')
    .select('onboarding_complete, partner_complete')
    .eq('user_id', userId)
    .single();

  if (!onboarding || !onboarding.partner_complete) {
    // Has not visited Dr. Ourian's platform yet
    window.location.href = 'dashboard.html';
    return;
  }

  if (onboarding.partner_complete && !onboarding.onboarding_complete) {
    // Has purchased but not completed onboarding
    window.location.href = 'onboarding.html';
    return;
  }

  // Fully onboarded — go to dashboard
  window.location.href = 'dashboard.html';
}

// ── SIGN UP ───────────────────────────────────────────────

async function signUp(fullName, email, password, skinGoal) {
  const { data, error } = await db.auth.signUp({ email, password });

  if (error) {
    showError(error.message);
    return;
  }

  if (data.user) {
    // Create the user profile row in public.users
    const { error: profileError } = await db.from('users').insert({
      id:             data.user.id,
      full_name:      fullName,
      email:          email,
      preferred_lang: localStorage.getItem('tgr-language') || 'es'
    });

    if (profileError) {
      showError(profileError.message);
      return;
    }

    // Create a blank onboarding row
    await db.from('onboarding').insert({
      user_id:             data.user.id,
      onboarding_complete: false,
      partner_complete:    false
    });

    // Save skin goal locally for now
    localStorage.setItem('tgr-user', JSON.stringify({ fullName, email, skinGoal }));

    window.location.href = 'dashboard.html';
  }
}

// ── LOG IN ────────────────────────────────────────────────

async function logIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    showError(error.message);
    return;
  }

  if (data.user) {
    await redirectByOnboardingStatus(data.user.id);
  }
}

// ── LOG OUT ───────────────────────────────────────────────

async function logOut() {
  await db.auth.signOut();
  localStorage.clear();
  window.location.href = 'index.html';
}

// ── SAVE ONBOARDING DATA ──────────────────────────────────

async function saveOnboarding(formData) {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const userId = session.user.id;

  // Save skin analysis
  await db.from('skin_analysis').upsert({
    user_id:     userId,
    skin_type:   formData.skinType,
    skin_concern:formData.skinConcern,
    goal:        formData.goal,
    sensitivity: formData.sensitivity,
    notes:       formData.notes
  }, { onConflict: 'user_id' });

  // Save purchase
  await db.from('purchases').insert({
    user_id:         userId,
    product_name:    formData.productName,
    order_reference: formData.orderReference,
    purchase_date:   formData.purchaseDate,
    amount_paid:     formData.amountPaid ? parseFloat(formData.amountPaid.replace(',', '.')) : null,
    confirmed:       formData.purchaseConfirmed
  });

  // Update onboarding
  await db.from('onboarding').upsert({
    user_id:             userId,
    daily_minutes:       parseInt(formData.time),
    routine_level:       formData.level,
    ritual_duration:     parseInt(formData.timeline),
    current_routine:     formData.currentRoutine,
    additional_notes:    formData.notes,
    onboarding_complete: true,
    partner_complete:    true,
    completed_at:        new Date().toISOString()
  }, { onConflict: 'user_id' });

  window.location.href = 'dashboard.html';
}

// ── MARK RITUAL DAY COMPLETE ──────────────────────────────

async function completeRitualDay(notes = '') {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return;

  const today = new Date().toISOString().split('T')[0];

  const { error } = await db.from('ritual_calendar').upsert({
    user_id:        session.user.id,
    completed_date: today,
    notes:          notes
  }, { onConflict: 'user_id,completed_date' });

  if (error) {
    console.error('Error completing ritual day:', error.message);
    return false;
  }

  return true;
}

// ── LOAD DASHBOARD DATA ───────────────────────────────────

async function loadDashboardData() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return null; }

  const userId = session.user.id;

  // Load all data in parallel
  const [userRes, skinRes, onboardRes, purchaseRes, calendarRes, rewardsRes] = await Promise.all([
    db.from('users').select('*').eq('id', userId).single(),
    db.from('skin_analysis').select('*').eq('user_id', userId).single(),
    db.from('onboarding').select('*').eq('user_id', userId).single(),
    db.from('purchases').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single(),
    db.from('ritual_calendar').select('completed_date').eq('user_id', userId).order('completed_date', { ascending: false }),
    db.from('user_rewards').select('*, rewards(*)').eq('user_id', userId)
  ]);

  const completedDates = (calendarRes.data || []).map(r => r.completed_date);
  const daysCompleted  = completedDates.length;
  const streak         = calculateStreak(completedDates);

  return {
    user:           userRes.data,
    skinAnalysis:   skinRes.data,
    onboarding:     onboardRes.data,
    purchase:       purchaseRes.data,
    completedDates,
    daysCompleted,
    streak,
    rewards:        rewardsRes.data || []
  };
}

// ── CALCULATE STREAK ──────────────────────────────────────

function calculateStreak(dates) {
  if (!dates || dates.length === 0) return 0;

  const sorted = [...dates].sort((a, b) => new Date(b) - new Date(a));
  const today  = new Date(); today.setHours(0,0,0,0);
  let streak   = 0;
  let check    = new Date(today);

  for (const dateStr of sorted) {
    const d = new Date(dateStr); d.setHours(0,0,0,0);
    if (d.getTime() === check.getTime()) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// ── HELPER: SHOW ERROR MESSAGE ────────────────────────────

function showError(message) {
  const existing = document.getElementById('tgr-error');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'tgr-error';
  div.style.cssText = 'background:#fee;border:1px solid #fcc;color:#900;padding:12px 16px;margin-bottom:1rem;font-size:13px;line-height:1.5;';
  div.textContent = message;

  const form = document.querySelector('form');
  if (form) form.prepend(div);
}

// ── EXPOSE FUNCTIONS GLOBALLY ─────────────────────────────
window.tgr = {
  checkSession,
  signUp,
  logIn,
  logOut,
  saveOnboarding,
  completeRitualDay,
  loadDashboardData,
  calculateStreak
};
