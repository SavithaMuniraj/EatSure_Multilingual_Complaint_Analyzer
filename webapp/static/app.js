import { createClient } from "https://esm.sh/@supabase/supabase-js@2.118.0";

const root = document.getElementById("app");
let supabase;
let activeSession = null;
let recoveryCallbackPending = false;
let activePage = "overview";
let customerRows = [];
let customerProfiles = [];
let profileByRef = new Map();
let statusTimer;
let resetCooldownTimer;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const showNotice = (message, kind = "success") => {
  const target = document.querySelector("[data-status]");
  if (!target) return;
  target.innerHTML = `<div class="notice ${kind}">${escapeHtml(message)}</div>`;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { if (target) target.innerHTML = ""; }, 7000);
};

async function initialize() {
  try {
    const currentUrl = new URL(location.href);
    const callbackParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
    const callbackCode = currentUrl.searchParams.get("error_code") || callbackParams.get("error_code");
    recoveryCallbackPending = currentUrl.searchParams.get("recovery") === "1" || currentUrl.searchParams.get("type") === "recovery" || currentUrl.hash.includes("type=recovery") || callbackCode === "otp_expired";
    const response = await fetch("/api/config");
    const config = await response.json();
    if (!response.ok) throw new Error(config.detail || "App configuration is missing.");
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {auth:{flowType:"pkce",persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data:{session}} = await supabase.auth.getSession();
    activeSession = session;
    supabase.auth.onAuthStateChange((event, nextSession) => {
      activeSession = nextSession;
      if (event === "PASSWORD_RECOVERY" || (recoveryCallbackPending && nextSession)) {
        recoveryCallbackPending = false;
        renderRecoveryPasswordForm();
      } else render();
    });
    if (recoveryCallbackPending) {
      if (session) { recoveryCallbackPending = false; renderRecoveryPasswordForm(); }
      else { authShell("forgot"); showNotice("This email link is invalid or expired. You can request a new password reset link below.", "error"); }
    } else render();
  } catch (error) {
    root.innerHTML = `<main class="auth-bg"><section class="card auth-card"><h1>EatSure setup needed</h1><div class="notice error">${escapeHtml(error.message)}</div><p class="muted">The web service needs its Supabase URL and publishable key configured.</p></section></main>`;
  }
}

function authShell(mode="login") {
  clearInterval(resetCooldownTimer);
  const selected = mode === "signup" ? 1 : 0;
  const headline = mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Sign in to EatSure";
  root.innerHTML = `<main class="auth-bg"><section class="card auth-card"><header class="auth-heading"><div class="brand-mark" style="margin:auto">🍽️</div><h1>${headline}</h1><div class="muted small">Complaint intelligence for customer care teams</div></header><div data-status></div>${mode !== "forgot" ? `<div class="auth-tabs"><button data-auth-mode="login" class="${selected===0?"active":""}">Sign in</button><button data-auth-mode="signup" class="${selected===1?"active":""}">Create account</button></div>` : ""}<form id="auth-form" novalidate>${mode === "login" ? `<div class="field"><label for="login-id">Username or Gmail</label><input id="login-id" autocomplete="username" required placeholder="Your username or name@gmail.com"></div><div class="field"><label for="login-password">Password</label><div class="password-input"><input id="login-password" type="password" autocomplete="current-password" required><button class="password-toggle" type="button" data-toggle-password aria-label="Show password" aria-pressed="false">Show</button></div></div><button class="button" style="width:100%">Sign in</button><div class="auth-footer"><button type="button" class="link-button" data-auth-mode="forgot">Forgot password?</button></div>` : mode === "signup" ? `<div class="field"><label for="signup-email">Gmail address</label><input id="signup-email" type="email" autocomplete="email" placeholder="name@gmail.com" required></div><div class="field"><label for="signup-username">Create username</label><input id="signup-username" autocomplete="username" minlength="3" maxlength="30" pattern="[A-Za-z0-9_]+" required></div><div class="field"><label for="signup-password">Create password (minimum 5 characters)</label><input id="signup-password" type="password" autocomplete="new-password" minlength="5" required></div><div class="field"><label for="signup-confirm">Confirm password</label><input id="signup-confirm" type="password" autocomplete="new-password" minlength="5" required></div><button class="button" style="width:100%">Create account</button><p class="auth-footer">We’ll email a confirmation link to activate your account.</p>` : `<div class="field"><label for="reset-account">Username or Gmail address</label><input id="reset-account" autocomplete="username" required placeholder="Your username or name@gmail.com"></div><button class="button" id="send-reset-link" type="button" style="width:100%">Email me a reset link</button><p class="muted small reset-help" id="reset-help">We’ll email a secure password reset link to the Gmail address linked to your account. Open the link to choose a new password.</p><div class="auth-footer"><button type="button" class="link-button" data-auth-mode="login">Back to sign in</button></div>`}</form><div class="auth-footer">Your customer workspace is private to your account.</div></section></main>`;
  root.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => authShell(button.dataset.authMode)));
  root.querySelectorAll("[data-toggle-password]").forEach((passwordToggle) => {
    const passwordInput = passwordToggle.closest(".password-input")?.querySelector("input");
    if (!passwordInput) return;
    passwordToggle.addEventListener("click", () => {
      const reveal = passwordInput.type === "password";
      passwordInput.type = reveal ? "text" : "password";
      passwordToggle.textContent = reveal ? "Hide" : "Show";
      passwordToggle.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
      passwordToggle.setAttribute("aria-pressed", String(reveal));
      passwordInput.focus();
    });
  });
  if (mode === "forgot") {
    const requestButton = root.querySelector("#send-reset-link");
    const accountInput = root.querySelector("#reset-account");
    const sendResetLink = async () => {
      const account = accountInput.value.trim();
      if (!account) return showNotice("Enter the username or Gmail address on your account.", "error");
      if (account.includes("@") && !/^[^\s@]+@gmail\.com$/i.test(account)) return showNotice("Enter a Gmail address ending in @gmail.com, or use your username.", "error");
      if (!account.includes("@") && !/^[A-Za-z0-9_]{3,30}$/.test(account)) return showNotice("Enter your Gmail address or your 3–30 character username.", "error");
      requestButton.disabled = true;
      requestButton.textContent = "Sending reset link…";
      try {
        await gateway({action:"reset_request", account, redirect_to:`${location.origin}/?recovery=1`});
        showNotice("If an account matches those details, a password reset link has been emailed. Check Gmail, including Spam.");
        let remaining = 60;
        requestButton.textContent = `Resend reset link in ${remaining}s`;
        clearInterval(resetCooldownTimer);
        resetCooldownTimer = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            clearInterval(resetCooldownTimer);
            requestButton.disabled = false;
            requestButton.textContent = "Resend reset link";
          } else requestButton.textContent = `Resend reset link in ${remaining}s`;
        }, 1000);
      } catch (error) {
        showNotice(error.message || "We couldn’t send the reset link. Please try again later.", "error");
        requestButton.disabled = false;
        requestButton.textContent = "Email me a reset link";
      }
    };
    requestButton.addEventListener("click", sendResetLink);
    accountInput.addEventListener("input", () => {
      clearInterval(resetCooldownTimer);
      requestButton.disabled = false;
      requestButton.textContent = "Email me a reset link";
    });
    return;
  }
  root.querySelector("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button=root.querySelector("#auth-form .button"); button.disabled=true; button.textContent="Please wait…";
    try {
      if (mode === "login") {
        const result=await gateway({action:"login",username:root.querySelector("#login-id").value.trim(),password:root.querySelector("#login-password").value});
        const {error}=await supabase.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
        if(error) throw error;
      } else {
        const email=root.querySelector("#signup-email").value.trim().toLowerCase(); const username=root.querySelector("#signup-username").value.trim(); const password=root.querySelector("#signup-password").value; const confirm=root.querySelector("#signup-confirm").value;
        if(!email.endsWith("@gmail.com")) throw new Error("Enter a Gmail address ending in @gmail.com.");
        if(!/^[A-Za-z0-9_]{3,30}$/.test(username)) throw new Error("Use 3–30 letters, numbers, or underscores for the username.");
        if(password.length<5) throw new Error("Use a password with at least 5 characters.");
        if(password!==confirm) throw new Error("The passwords do not match.");
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{username},emailRedirectTo:location.origin}});
        if(error) throw error;
        if(data.user?.identities?.length===0) throw new Error("An account already exists for this Gmail. Sign in or reset its password.");
        root.innerHTML=`<main class="auth-bg"><section class="card auth-card center"><div class="brand-mark" style="margin:0 auto 16px">✉️</div><h1>Confirm your Gmail</h1><p class="muted">Open Gmail and click the confirmation link to activate your EatSure account.</p><p><a class="button" href="https://mail.google.com/" target="_blank" rel="noopener">Open Gmail</a></p><button class="button secondary small" id="resend-confirmation">Resend confirmation email</button><p class="auth-footer">After confirming, return here and sign in.</p><div data-status></div></section></main>`;
        root.querySelector("#resend-confirmation").addEventListener("click",async()=>{const {error}=await supabase.auth.resend({type:"signup",email});if(error)showNotice(error.message,"error");else showNotice("A new confirmation link was sent. Check Gmail and spam.");});
      }
    } catch(error) { showNotice(error.message || "We couldn’t complete that request.","error"); button.disabled=false; button.textContent=mode==="login"?"Sign in":"Create account"; }
  });
}

function renderRecoveryPasswordForm() {
  if (!activeSession) {
    authShell("forgot");
    showNotice("This password reset link is invalid or has expired. Request a new reset link below.", "error");
    return;
  }
  root.innerHTML = `<main class="auth-bg"><section class="card auth-card"><header class="auth-heading"><div class="brand-mark" style="margin:auto">🍽️</div><h1>Choose a new password</h1><div class="muted small">Set a new password for your EatSure account</div></header><div data-status></div><form id="link-reset-form" novalidate><div class="field"><label for="link-reset-password">New password (minimum 5 characters)</label><div class="password-input"><input id="link-reset-password" type="password" minlength="5" autocomplete="new-password" required><button class="password-toggle" type="button" data-link-toggle aria-label="Show password" aria-pressed="false">Show</button></div></div><div class="field"><label for="link-reset-confirm">Confirm new password</label><div class="password-input"><input id="link-reset-confirm" type="password" minlength="5" autocomplete="new-password" required><button class="password-toggle" type="button" data-link-toggle aria-label="Show password" aria-pressed="false">Show</button></div></div><button class="button" id="save-link-password" style="width:100%">Update password</button></form><div class="auth-footer">Your customer workspace is private to your account.</div></section></main>`;
  root.querySelectorAll("[data-link-toggle]").forEach((toggle) => toggle.addEventListener("click", () => {
    const input = toggle.closest(".password-input").querySelector("input");
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    toggle.textContent = reveal ? "Hide" : "Show";
    toggle.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    toggle.setAttribute("aria-pressed", String(reveal));
    input.focus();
  }));
  root.querySelector("#link-reset-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = root.querySelector("#link-reset-password").value;
    const confirm = root.querySelector("#link-reset-confirm").value;
    const button = root.querySelector("#save-link-password");
    if (password.length < 5) return showNotice("Use a password with at least 5 characters.", "error");
    if (password !== confirm) return showNotice("The passwords do not match.", "error");
    button.disabled = true;
    button.textContent = "Updating password…";
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut();
      authShell("login");
      showNotice("Password reset successfully. Sign in with your new password.");
    } catch (error) {
      showNotice(error.message || "Could not update the password. Request a new reset link and try again.", "error");
      button.disabled = false;
      button.textContent = "Update password";
    }
  });
}

async function gateway(payload) {
  const response=await fetch(`${(await getConfig()).supabaseUrl}/functions/v1/auth-gateway`,{method:"POST",headers:{apikey:(await getConfig()).supabaseAnonKey,Authorization:`Bearer ${(await getConfig()).supabaseAnonKey}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const body=await response.json().catch(()=>({})); if(!response.ok) throw new Error(body.error||"Authentication request failed."); return body;
}
let appConfig;
async function getConfig(){ if(!appConfig){const response=await fetch("/api/config");appConfig=await response.json();} return appConfig; }

function render() {
  if(!activeSession){authShell("login");return;}
  root.innerHTML=`<div class="shell"><header class="topbar"><div class="brand"><span class="brand-mark">🍽️</span><span>EatSure Intelligence</span></div><div class="top-actions"><span class="user-tag">${escapeHtml(activeSession.user.user_metadata?.username||activeSession.user.email||"Signed in")}</span><button class="button secondary small" id="logout">Sign out</button></div></header><nav class="nav"><button data-page="overview">Overview</button><button data-page="analyze">Analyze complaint</button><button data-page="customers">Customers</button></nav><main id="page"></main><p class="footnote">Predictions are decision support. Review sensitive and uncertain cases with a person. Customer profile fields are isolated to your signed-in account; complaint text from the bundled dataset is not displayed or copied to customer profiles.</p></div>`;
  root.querySelectorAll("[data-page]").forEach(button=>{button.classList.toggle("active",button.dataset.page===activePage);button.addEventListener("click",()=>{activePage=button.dataset.page;render();});});
  root.querySelector("#logout").addEventListener("click",()=>supabase.auth.signOut());
  if(activePage==="customers") renderCustomers(); else if(activePage==="analyze") renderAnalyzer(); else renderOverview();
}

function hero(title,subtitle){return `<section class="hero"><div class="eyebrow">EatSure · Customer care intelligence</div><h1>${title}</h1><p>${subtitle}</p></section>`;}
function metric(label,value,note=""){return `<article class="card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></article>`;}

function renderOverview(){
  const page=root.querySelector("#page");page.innerHTML=hero("Complaint Intelligence","Understand customer issues across English and Indian languages, then review patterns and next actions.")+`<section class="grid three-col"><article class="card"><div class="eyebrow">01 · Analyze</div><h2>One complaint</h2><p class="muted">Classify a complaint and see the words that most influenced the suggested category.</p><button class="button" data-go="analyze">Analyze a complaint</button></article><article class="card"><div class="eyebrow">02 · Customers</div><h2>Customer patterns</h2><p class="muted">Compare customers with one recorded complaint to repeat complainants and edit your private customer details.</p><button class="button secondary" data-go="customers">Open customer workspace</button></article><article class="card"><div class="eyebrow">03 · Private by account</div><h2>Your workspace</h2><p class="muted">Customer contact details and notes are protected by Supabase row-level security.</p></article></section>`;
  page.querySelectorAll("[data-go]").forEach(button=>button.addEventListener("click",()=>{activePage=button.dataset.go;render();}));
}

function renderAnalyzer(){
  const page=root.querySelector("#page");page.innerHTML=hero("Analyze a complaint","Enter a customer message to classify the category and inspect short word-level signals.")+`<section class="card"><form id="analyze-form"><div class="field"><label for="complaint">Customer complaint</label><textarea id="complaint" required minlength="2" maxlength="5000" placeholder="Example: मेरा पैसा कट गया लेकिन ऑर्डर नहीं हुआ।"></textarea></div><div class="grid two-col"><div class="field"><label for="language">Language</label><select id="language"><option>Auto detect</option><option>English</option><option>Hinglish</option><option>Hindi</option><option>Tamil</option><option>Telugu</option><option>Kannada</option><option>Malayalam</option><option>Bengali</option><option>Gujarati</option><option>Punjabi</option><option>Other / unsure</option></select></div><label class="field"><span>English translation</span><span><input type="checkbox" id="translate"> Also translate to English</span></label></div><button class="button">Analyze complaint</button></form><div data-status></div><div id="analysis-result"></div></section>`;
  page.querySelector("#analyze-form").addEventListener("submit",async(event)=>{event.preventDefault();const button=page.querySelector("#analyze-form .button");button.disabled=true;button.textContent="Analyzing…";try{const response=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${activeSession.access_token}`},body:JSON.stringify({text:page.querySelector("#complaint").value,language:page.querySelector("#language").value,translate:page.querySelector("#translate").checked})});const result=await response.json();if(!response.ok)throw new Error(result.detail||"Analysis failed.");const target=page.querySelector("#analysis-result");if(!result.supported){target.innerHTML=`<div class="notice">${escapeHtml(result.note)}</div>`;return;}target.innerHTML=`<article class="card" style="margin-top:20px"><div class="eyebrow">Suggested category</div><div class="result-head">${escapeHtml(result.category)}</div><p class="muted">Language: ${escapeHtml(result.language)} · ${result.confidence===undefined?"Needs review":result.confidence>=.75?"High confidence":result.confidence>=.5?"Review recommended":"Manual review recommended"}</p><div class="grid three-col"><div><b>Top category signals</b><div class="signal-list">${result.top_features?.length?result.top_features.map(word=>`<span class="signal">${escapeHtml(word)}</span>`).join(""):'<span class="muted small">No clear word-level signals</span>'}</div></div><div><b>Suggested sentiment</b><p>${escapeHtml(result.sentiment)}</p></div><div><b>Suggested priority</b><p>${escapeHtml(result.priority)}</p></div></div><p class="small muted">Suggested subcategory: ${escapeHtml(result.subcategory)}</p>${result.translated?`<div class="notice"><b>English translation:</b> ${escapeHtml(result.translated)}</div>`:""}${result.note?`<p class="muted small">${escapeHtml(result.note)}</p>`:""}</article>`;}catch(error){showNotice(error.message,"error");}finally{button.disabled=false;button.textContent="Analyze complaint";}});
}

async function renderCustomers(){
  const page=root.querySelector("#page");page.innerHTML=hero("Customer workspace","Understand who is raising repeat complaints, review customer details, and edit your private records.")+`<div class="loading-inline">Loading customer summary…</div>`;
  try{
    const [activityResponse,profileResponse]=await Promise.all([fetch("/api/customers",{headers:{Authorization:`Bearer ${activeSession.access_token}`}}),supabase.from("customer_profiles").select("customer_ref,display_name,email,phone,notes,updated_at").order("updated_at",{ascending:false})]);
    const activity=await activityResponse.json();if(!activityResponse.ok)throw new Error(activity.detail||"Could not load customer activity.");if(profileResponse.error)throw new Error(`${profileResponse.error.message}. Apply supabase/customer_profiles.sql if the table is missing.`);
    customerRows=activity.customers||[];customerProfiles=profileResponse.data||[];profileByRef=new Map(customerProfiles.map(profile=>[profile.customer_ref,profile]));
    const one=customerRows.filter(row=>row.total_complaints===1).length;const repeat=customerRows.filter(row=>row.total_complaints>1).length;const repeatVolume=customerRows.filter(row=>row.total_complaints>1).reduce((sum,row)=>sum+row.total_complaints,0);const max=Math.max(one,repeat,1);
    page.innerHTML=hero("Customer workspace","Understand who is raising repeat complaints, review customer details, and edit your private records.")+`<section class="grid metrics">${metric("Total customers",customerRows.length.toLocaleString(),"IDs found in the supplied dataset")}${metric("One recorded complaint",one.toLocaleString(),"One complaint in this dataset")}${metric("Repeat complainants",repeat.toLocaleString(),"More than one recorded complaint")}${metric("Complaints from repeat customers",repeatVolume.toLocaleString(),"Recorded rows in the dataset")}</section><section class="grid two-col"><article class="card"><h2 class="section-title" style="margin-top:0">One-time and repeat customers</h2><div class="bars"><div class="bar-row"><span>One recorded complaint</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(one/max*100)}%"></div></div><b>${one.toLocaleString()}</b></div><div class="bar-row"><span>Repeat complainants</span><div class="bar-track"><div class="bar-fill blue" style="width:${Math.round(repeat/max*100)}%"></div></div><b>${repeat.toLocaleString()}</b></div></div><p class="small muted">Counts describe the bundled data only; one recorded complaint does not prove that a person is a new customer.</p></article><article class="card"><h2 class="section-title" style="margin-top:0">Most frequent complainants</h2><div class="table-wrap"><table><thead><tr><th>Customer</th><th>Complaints</th><th>Most common category</th></tr></thead><tbody>${customerRows.filter(row=>row.total_complaints>1).slice(0,8).map(row=>`<tr><td>${escapeHtml(profileByRef.get(row.customer_id)?.display_name||row.customer_id)}</td><td><span class="badge repeat">${row.total_complaints}</span></td><td>${escapeHtml(row.common_category||"—")}</td></tr>`).join("")||'<tr><td colspan="3">No repeat complainants found.</td></tr>'}</tbody></table></div></article></section><h2 class="section-title">Customer details</h2><div class="card"><div class="toolbar"><div class="field"><label for="customer-search">Search customers</label><input id="customer-search" placeholder="Customer ID or saved name"></div><div class="field"><label for="customer-picker">Select a customer to edit</label><select id="customer-picker"></select></div></div><div id="customer-table" class="table-wrap" style="margin-top:16px"></div><div id="edit-customer" style="margin-top:22px"></div><div data-status></div></div><p class="small muted">The customer counts are calculated from the repository dataset. Customer names, contact fields, and notes are saved only in your signed-in account. Complaint text is not displayed.</p>`;
    const picker=page.querySelector("#customer-picker");picker.innerHTML=customerRows.map(row=>{const profile=profileByRef.get(row.customer_id);return `<option value="${escapeHtml(row.customer_id)}">${escapeHtml(profile?.display_name||row.customer_id)} · ${row.total_complaints} complaint(s)</option>`;}).join("");
    const drawTable=()=>{const query=page.querySelector("#customer-search").value.trim().toLowerCase();const rows=customerRows.filter(row=>!query||row.customer_id.toLowerCase().includes(query)||(profileByRef.get(row.customer_id)?.display_name||"").toLowerCase().includes(query)).slice(0,100);page.querySelector("#customer-table").innerHTML=`<table><thead><tr><th>Customer</th><th>Complaint group</th><th>Complaints</th><th>Most common category</th><th>Latest complaint</th></tr></thead><tbody>${rows.map(row=>{const profile=profileByRef.get(row.customer_id);return `<tr><td>${escapeHtml(profile?.display_name||row.customer_id)}</td><td><span class="badge ${row.total_complaints>1?"repeat":""}">${row.total_complaints>1?"Repeat":"One recorded"}</span></td><td>${row.total_complaints}</td><td>${escapeHtml(row.common_category||"—")}</td><td>${escapeHtml(row.last_complaint?new Date(row.last_complaint).toLocaleDateString():"—")}</td></tr>`;}).join("")}</tbody></table>`;};
    const drawEdit=()=>{const row=customerRows.find(item=>item.customer_id===picker.value);if(!row)return;const profile=profileByRef.get(row.customer_id)||{};page.querySelector("#edit-customer").innerHTML=`<h2 class="section-title">Edit customer</h2><p class="muted small">${escapeHtml(row.customer_id)} · ${row.total_complaints} recorded complaint(s) · ${escapeHtml(row.cohort)}</p><form id="edit-form" class="edit-grid"><div class="field"><label for="customer-name">Customer name</label><input id="customer-name" maxlength="120" value="${escapeHtml(profile.display_name||"")}"></div><div class="field"><label for="customer-email">Email (optional)</label><input id="customer-email" type="email" maxlength="254" value="${escapeHtml(profile.email||"")}"></div><div class="field"><label for="customer-phone">Phone (optional)</label><input id="customer-phone" maxlength="40" value="${escapeHtml(profile.phone||"")}"></div><div class="field wide"><label for="customer-notes">Private notes (optional)</label><textarea id="customer-notes" maxlength="1000" style="min-height:80px">${escapeHtml(profile.notes||"")}</textarea></div><div class="wide"><button class="button">Save customer details</button></div></form>`;page.querySelector("#edit-form").addEventListener("submit",async event=>{event.preventDefault();const save=event.currentTarget.querySelector("button");save.disabled=true;try{const {error}=await supabase.from("customer_profiles").upsert({owner_id:activeSession.user.id,customer_ref:row.customer_id,display_name:page.querySelector("#customer-name").value.trim()||null,email:page.querySelector("#customer-email").value.trim()||null,phone:page.querySelector("#customer-phone").value.trim()||null,notes:page.querySelector("#customer-notes").value.trim()||null},{onConflict:"owner_id,customer_ref"});if(error)throw error;profileByRef.set(row.customer_id,{customer_ref:row.customer_id,display_name:page.querySelector("#customer-name").value.trim(),email:page.querySelector("#customer-email").value.trim(),phone:page.querySelector("#customer-phone").value.trim(),notes:page.querySelector("#customer-notes").value.trim()});showNotice("Customer details saved to your private workspace.");drawTable();}catch(error){showNotice(error.message,"error");}finally{save.disabled=false;}});};
    page.querySelector("#customer-search").addEventListener("input",drawTable);picker.addEventListener("change",drawEdit);drawTable();drawEdit();
  }catch(error){page.innerHTML=hero("Customer workspace","Customer information is protected behind sign-in.")+`<article class="card"><div class="notice error">${escapeHtml(error.message)}</div><p class="muted small">If you just created the database table, refresh this page after Supabase finishes exposing it through the Data API.</p></article>`;}
}

initialize();
