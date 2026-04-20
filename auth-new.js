const db = window.supabaseClient;

async function signUpNew(email, password, fullName) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data?.user) {
    // Create user profile
    await db.from("users_simple").insert({
      id: data.user.id,
      email: email,
      full_name: fullName
    });
  }

  return { ok: true, user: data?.user || null };
}

async function logInNew(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: error.message };
  }

  if (data?.user) {
    return { ok: true, user: data.user };
  }

  return { ok: false, error: "No user returned" };
}

function logOutNew() {
  localStorage.removeItem("tgr-language");
  db.auth.signOut().catch(err => console.error("SignOut error:", err));
  
  setTimeout(() => {
    window.location.href = "index-new.html";
  }, 100);
}

async function getSessionNew() {
  const { data: { session } } = await db.auth.getSession();
  return session;
}

async function updateProfileNew(fullName, skinType, goal) {
  const session = await getSessionNew();
  if (!session) return { ok: false };

  const { error } = await db.from("users_simple").update({
    full_name: fullName,
    skin_type: skinType,
    goal: goal
  }).eq("id", session.user.id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function completeRitualNew() {
  const session = await getSessionNew();
  if (!session) return { ok: false };

  const today = new Date().toISOString().split("T")[0];

  const { error } = await db.from("ritual_tracking").upsert({
    user_id: session.user.id,
    completed_date: today,
    completed_at: new Date().toISOString()
  }, { onConflict: "user_id,completed_date" });

  if (error) return { ok: false, error: error.message };

  // Trigger email notification (via function or webhook)
  await sendCompletionEmail(session.user.email, session.user.user_metadata?.full_name || "User");

  return { ok: true };
}

async function sendCompletionEmail(email, name) {
  // Call a Supabase Edge Function or backend API
  try {
    await db.functions.invoke('send-completion-email', {
      body: { email, name }
    });
  } catch (err) {
    console.error("Email error:", err);
  }
}

async function getUserProfileNew() {
  const session = await getSessionNew();
  if (!session) return null;

  const { data } = await db.from("users_simple").select("*").eq("id", session.user.id).single();
  return data;
}

async function getRitualStatsNew() {
  const session = await getSessionNew();
  if (!session) return null;

  const { data } = await db.from("ritual_tracking").select("completed_date").eq("user_id", session.user.id);
  
  const completedDates = (data || []).map(r => r.completed_date);
  const daysCompleted = completedDates.length;
  
  // Calculate streak
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  let check = new Date(today);

  for (const dateStr of completedDates.sort((a, b) => new Date(b) - new Date(a))) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === check.getTime()) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  return { daysCompleted, streak, completedDates };
}

window.tgrNew = {
  signUpNew,
  logInNew,
  logOutNew,
  getSessionNew,
  updateProfileNew,
  completeRitualNew,
  getUserProfileNew,
  getRitualStatsNew
};
