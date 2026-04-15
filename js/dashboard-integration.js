// ============================================================
// TENERIFE GLOW RITUAL — Dashboard Integration
// ============================================================
// Loads real user data from Supabase and populates the
// dashboard. Replace localStorage references with live data.
// ============================================================

document.addEventListener('DOMContentLoaded', async function () {

  // Load all user data from Supabase
  const data = await window.tgr.loadDashboardData();
  if (!data) return; // loadDashboardData handles redirect if not logged in

  const {
    user,
    skinAnalysis,
    onboarding,
    purchase,
    completedDates,
    daysCompleted,
    streak,
    rewards
  } = data;

  // ── HELPER ──────────────────────────────────────────────
  const el  = id => document.getElementById(id);
  const set = (id, val) => { const e = el(id); if (e) e.textContent = val || '—'; };

  const goalMap  = { glow:'Luminosidad', hydration:'Hidratación', antiage:'Anti-edad', acne:'Acné', balance:'Equilibrio' };
  const skinMap  = { normal:'Normal', dry:'Seca', oily:'Grasa', combination:'Mixta', sensitive:'Sensible' };
  const timeMap  = { 5:'5 min', 10:'10 min', 20:'20 min' };

  const formatGoal = () => goalMap[skinAnalysis?.goal] || skinAnalysis?.goal || '—';
  const formatSkin = () => skinMap[skinAnalysis?.skin_type] || '—';
  const formatTime = () => timeMap[onboarding?.daily_minutes] || (onboarding?.daily_minutes + ' min') || '—';

  const ritualDuration  = onboarding?.ritual_duration || 90;
  const rewardProgress  = Math.min(daysCompleted, 14);
  const consistency     = ritualDuration > 0 ? Math.round((daysCompleted / ritualDuration) * 100) : 0;
  const partnerDone     = onboarding?.partner_complete || false;
  const onboardingDone  = onboarding?.onboarding_complete || false;

  // ── HERO BANNER ─────────────────────────────────────────
  const heroTitle = el('heroTitle');
  const heroCopy  = el('heroCopy');
  const heroActions = el('heroActions');

  if (!partnerDone) {
    if (heroTitle) heroTitle.innerHTML = 'Completa tu análisis<br><em>de piel.</em>';
    if (heroCopy)  heroCopy.textContent = 'Para comenzar tu ritual, visita la plataforma del Dr. Ourian para tu análisis y compra de productos.';
    if (heroActions) heroActions.innerHTML = `<a href="https://www.simonourianmd.com/BBF/?ref=tgr" target="_blank" rel="noopener" class="btn btn-gold">Ir a la plataforma →</a>`;
  } else if (!onboardingDone) {
    if (heroTitle) heroTitle.innerHTML = 'Activa tu ritual<br><em>personalizado.</em>';
    if (heroCopy)  heroCopy.textContent = 'Tu compra está completada. Ahora configura tu ritual para desbloquear tu calendario diario.';
    if (heroActions) heroActions.innerHTML = `<a href="onboarding.html" class="btn btn-gold">Completar onboarding →</a>`;
  } else {
    const currentDay = Math.min(daysCompleted + 1, ritualDuration);
    if (heroTitle) heroTitle.innerHTML = `Bienvenida de nuevo —<br><em>día ${currentDay} de tu ritual.</em>`;
    if (heroCopy)  heroCopy.textContent = `Continúa tu ritual de ${formatTime()} de hoy. La constancia transforma.`;
    if (heroActions) heroActions.innerHTML = `<a href="daily.html" class="btn btn-gold">Completar ritual de hoy →</a><a href="onboarding.html" class="btn btn-outline-light">Editar perfil</a>`;
  }

  // ── REWARD RING ──────────────────────────────────────────
  const circumference = 2 * Math.PI * 46;
  const pct    = rewardProgress / 14;
  const offset = circumference - (pct * circumference);
  const ring   = el('rewardRingCircle');
  if (ring) {
    ring.style.strokeDasharray  = circumference;
    ring.style.strokeDashoffset = circumference;
    setTimeout(() => {
      ring.style.transition      = 'stroke-dashoffset 1.2s ease';
      ring.style.strokeDashoffset = offset;
    }, 300);
  }
  set('rewardRingNum', rewardProgress);
  const milestone = el('rewardMilestone');
  if (milestone) milestone.textContent = rewardProgress >= 14 ? '¡Recompensa desbloqueada!' : 'días hacia tu spa';

  // ── METRICS ──────────────────────────────────────────────
  set('metricPurchase',  partnerDone    ? 'Completada' : 'Pendiente');
  set('metricOnboarding',onboardingDone ? 'Completada' : 'Pendiente');
  set('metricDays',       daysCompleted);
  set('metricConsistency', consistency + '%');

  const pb = el('metricPurchaseBadge');
  if (pb) { pb.textContent = partnerDone ? '✓ Hecho' : 'Pendiente'; pb.className = 'metric-badge ' + (partnerDone ? 'badge-done' : 'badge-pending'); }

  const ob = el('metricOnboardingBadge');
  if (ob) { ob.textContent = onboardingDone ? '✓ Hecho' : 'Pendiente'; ob.className = 'metric-badge ' + (onboardingDone ? 'badge-done' : 'badge-pending'); }

  const mt = el('metricTotal'); if (mt) mt.textContent = ritualDuration;

  // ── RITUAL STEPS ─────────────────────────────────────────
  const stepsEl = el('ritualSteps');
  if (stepsEl) {
    stepsEl.innerHTML = `
      <div class="ritual-step ${partnerDone ? 'done' : 'active'}">
        <div class="step-icon ${partnerDone ? 'done' : 'active'}">${partnerDone ? '✓' : '1'}</div>
        <div class="step-body">
          <p class="step-title">Análisis y compra</p>
          <p class="step-desc">${partnerDone ? 'Completados correctamente.' : 'Visita la plataforma del Dr. Ourian para tu análisis.'}</p>
        </div>
      </div>
      <div class="ritual-step ${onboardingDone ? 'done' : (partnerDone ? 'active' : 'pending')}">
        <div class="step-icon ${onboardingDone ? 'done' : (partnerDone ? 'active' : 'pending')}">${onboardingDone ? '✓' : '2'}</div>
        <div class="step-body">
          <p class="step-title">Onboarding</p>
          <p class="step-desc">${onboardingDone ? 'Perfil ritual configurado.' : 'Configura tu ritual personalizado.'}</p>
        </div>
      </div>
      <div class="ritual-step ${(onboardingDone && daysCompleted > 0) ? 'done' : (onboardingDone ? 'active' : 'pending')}">
        <div class="step-icon ${(onboardingDone && daysCompleted > 0) ? 'done' : (onboardingDone ? 'active' : 'pending')}">${(onboardingDone && daysCompleted > 0) ? '✓' : '3'}</div>
        <div class="step-body">
          <p class="step-title">Ritual diario</p>
          <p class="step-desc">${onboardingDone ? `Día ${Math.min(daysCompleted + 1, ritualDuration)} de ${ritualDuration}. ¡Sigue así!` : 'Disponible después del onboarding.'}</p>
        </div>
      </div>
    `;
  }

  // ── STREAK CALENDAR ───────────────────────────────────────
  const streakGrid = el('streakGrid');
  if (streakGrid) {
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 27; i >= 0; i--) {
      const d   = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const isToday = i === 0;
      const isDone  = completedDates.includes(key);
      const div = document.createElement('div');
      div.className = 'streak-day ' + (isToday ? 'today' : isDone ? 'done' : 'empty');
      div.textContent = d.getDate();
      streakGrid.appendChild(div);
    }
  }

  // ── PROGRESS CHART ────────────────────────────────────────
  const ctx = document.getElementById('progressChart');
  if (ctx && typeof Chart !== 'undefined') {
    const labels     = [];
    const dataPoints = [];
    let running = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 13; i >= 0; i--) {
      const d   = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (completedDates.includes(key)) running++;
      labels.push(d.getDate() + '/' + (d.getMonth() + 1));
      dataPoints.push(running);
    }
    new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: dataPoints,
          borderColor: '#C9A96E',
          backgroundColor: 'rgba(201,169,110,0.08)',
          borderWidth: 2,
          pointBackgroundColor: '#C9A96E',
          pointRadius: 3,
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'DM Sans'" }, color: '#8C7B6B', maxTicksLimit: 7 } },
          y: { grid: { color: 'rgba(214,201,176,0.3)' }, ticks: { font: { family: "'DM Sans'" }, color: '#8C7B6B', stepSize: 1 }, min: 0 }
        }
      }
    });
  }

  // ── CHART STATS ───────────────────────────────────────────
  set('statStreak',      streak);
  set('statCompleted',   daysCompleted);
  set('statConsistency', consistency + '%');

  // ── PRODUCT BLOCK ─────────────────────────────────────────
  const productBlock = el('productBlock');
  if (productBlock && purchase) {
    productBlock.innerHTML = `
      <div class="product-info">
        <div class="info-row"><span class="info-label">Producto</span><span class="info-val">${purchase.product_name || '—'}</span></div>
        <div class="info-row"><span class="info-label">Referencia</span><span class="info-val">${purchase.order_reference || '—'}</span></div>
        <div class="info-row"><span class="info-label">Fecha</span><span class="info-val">${purchase.purchase_date || '—'}</span></div>
        ${purchase.amount_paid ? `<div class="info-row"><span class="info-label">Importe</span><span class="info-val">${purchase.amount_paid} €</span></div>` : ''}
      </div>`;
  }

  // ── PROFILE ───────────────────────────────────────────────
  const fullName = user?.full_name || '';
  const initials = fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const avatar   = el('profileAvatar'); if (avatar) avatar.textContent = initials;
  set('profileName',  fullName);
  set('profileEmail', user?.email);

  const tagsEl = el('profileTags');
  if (tagsEl) {
    const tags = [formatGoal(), formatSkin(), formatTime()].filter(t => t && t !== '—');
    tagsEl.innerHTML = tags.map(t => `<span class="profile-tag">${t}</span>`).join('');
  }

  // ── REWARD BAR ────────────────────────────────────────────
  const pctBar = Math.min((rewardProgress / 14) * 100, 100);
  const barFill = el('rewardBarFill'); if (barFill) barFill.style.width = pctBar + '%';
  set('rewardDaysText', rewardProgress + ' / 14 días completados');

  // ── ACTION LINKS ──────────────────────────────────────────
  const actionLinks = el('actionLinks');
  if (actionLinks) {
    const state = !partnerDone ? 'partner' : !onboardingDone ? 'onboarding' : 'ritual';
    const actions = state === 'partner' ? [
      { href: 'https://www.simonourianmd.com/BBF/?ref=tgr', target: '_blank', title: 'Ir a la plataforma asociada', desc: 'Completa tu análisis y compra.' },
      { href: 'index.html', title: 'Volver al inicio', desc: 'Información general.' }
    ] : state === 'onboarding' ? [
      { href: 'onboarding.html', title: 'Completar onboarding', desc: 'Configura tu ritual personalizado.' },
      { href: 'index.html', title: 'Volver al inicio', desc: 'Información general.' }
    ] : [
      { href: 'daily.html', title: 'Completar ritual de hoy', desc: 'Abre tu calendario ritual.' },
      { href: 'onboarding.html', title: 'Editar mi perfil ritual', desc: 'Actualiza tu configuración.' },
      { href: 'products.html', title: 'Ver productos', desc: 'Explora los productos recomendados.' }
    ];
    actionLinks.innerHTML = actions.map(a => `
      <a href="${a.href}" class="action-link" ${a.target ? `target="${a.target}" rel="noopener"` : ''}>
        <div class="action-link-text"><strong>${a.title}</strong><span>${a.desc}</span></div>
        <span class="action-arrow">→</span>
      </a>`).join('');
  }

  // ── LOGOUT BUTTON ─────────────────────────────────────────
  const logoutBtn = el('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      window.tgr.logOut();
    });
  }

  // Apply translations if available
  if (window.applyTranslations) {
    const lang = user?.preferred_lang || localStorage.getItem('tgr-language') || 'es';
    window.applyTranslations(lang);
  }

});
