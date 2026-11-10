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
    // Establish Supabase recovery sessions from the callback fragment before rendering the auth screen.
    const recoveryAccessToken = callbackParams.get("access_token");
    const recoveryRefreshToken = callbackParams.get("refresh_token");
    if (recoveryCallbackPending && recoveryAccessToken && recoveryRefreshToken) {
      const {data: recoveryData, error: recoveryError} = await supabase.auth.setSession({access_token:recoveryAccessToken, refresh_token:recoveryRefreshToken});
      if (recoveryError) throw recoveryError;
      activeSession = recoveryData.session;
      history.replaceState(null, "", currentUrl.pathname + "?recovery=1");
    }
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
  root.innerHTML=`<div class="shell"><header class="topbar"><div class="brand"><span class="brand-mark">🍽️</span><span>EatSure Intelligence</span></div><div class="top-actions"><span class="user-tag">${escapeHtml(activeSession.user.user_metadata?.username||activeSession.user.email||"Signed in")}</span><button class="button secondary small" id="logout">Sign out</button></div></header><nav class="nav" aria-label="Main navigation"><button data-page="overview">Overview</button><button data-page="analyze">Analyze complaint</button><button data-page="batch">Batch analysis</button><button data-page="customers">Customers</button><button data-page="insights">Insights</button><button data-page="about">About the model</button></nav><main id="page"></main><p class="footnote">Predictions are decision support. Review sensitive and uncertain cases with a person. Customer profile fields are isolated to your signed-in account; complaint text from the bundled dataset is not displayed or copied to customer profiles.</p></div>`;
  root.querySelectorAll("[data-page]").forEach(button=>{button.classList.toggle("active",button.dataset.page===activePage);button.addEventListener("click",()=>{activePage=button.dataset.page;render();});});
  root.querySelector("#logout").addEventListener("click",()=>supabase.auth.signOut());
  if(activePage==="customers") renderCustomers(); else if(activePage==="analyze") renderAnalyzer(); else if(activePage==="batch") renderBatch(); else if(activePage==="insights") renderInsights(); else if(activePage==="about") renderAbout(); else renderOverview();
}

function hero(title,subtitle){return `<section class="hero"><div class="eyebrow">EatSure · Customer care intelligence</div><h1>${title}</h1><p>${subtitle}</p></section>`;}
function metric(label,value,note=""){return `<article class="card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></article>`;}

function renderOverview(){
  const page=root.querySelector("#page");page.innerHTML=hero("Complaint Intelligence","Understand customer issues across English and Indian languages, then prioritize the next action.")+`<section class="grid metrics" id="overview-metrics"><article class="card"><div class="metric-label">Categories</div><div class="metric-value">—</div></article><article class="card"><div class="metric-label">Supported languages</div><div class="metric-value">6</div></article><article class="card"><div class="metric-label">Model test accuracy</div><div class="metric-value">—</div></article><article class="card"><div class="metric-label">Test macro-F1</div><div class="metric-value">—</div></article></section><h2 class="section-title">Start with a task</h2><section class="grid three-col"><article class="card"><div class="eyebrow">01 · Single message</div><h2>Analyze one complaint</h2><p class="muted">Detect language, classify the issue, and review category signals.</p><button class="button" data-go="analyze">Analyze a complaint</button></article><article class="card"><div class="eyebrow">02 · CSV workflow</div><h2>Analyze a CSV</h2><p class="muted">Add predictions to a file and download it for follow-up.</p><button class="button secondary" data-go="batch">Open batch analysis</button></article><article class="card"><div class="eyebrow">03 · Aggregate trends</div><h2>Explore patterns</h2><p class="muted">Filter complaint trends by category, language, and month.</p><button class="button secondary" data-go="insights">Explore insights</button></article></section>`;
  page.querySelectorAll("[data-go]").forEach(button=>button.addEventListener("click",()=>{activePage=button.dataset.go;render();}));
  apiGet("/api/overview").then(data=>{const values=[data.categories?.length||0,data.supported_languages?.length||6,`${(data.test_accuracy*100).toFixed(1)}%`,`${(data.test_macro_f1*100).toFixed(1)}%`];page.querySelectorAll("#overview-metrics .metric-value").forEach((el,index)=>el.textContent=values[index]);}).catch(()=>{});
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
    page.innerHTML=hero("Customer workspace","Understand who is raising repeat complaints, review customer details, and edit your private records.")+`<section class="grid metrics">${metric("Total customers",customerRows.length.toLocaleString(),"IDs found in the supplied dataset")}${metric("One recorded complaint",one.toLocaleString(),"One complaint in this dataset")}${metric("Repeat complainants",repeat.toLocaleString(),"More than one recorded complaint")}${metric("Complaints from repeat customers",repeatVolume.toLocaleString(),"Recorded rows in the dataset")}</section><section class="grid two-col"><article class="card"><h2 class="section-title" style="margin-top:0">Customers by complaint history</h2><div id="customer-cohort-plot" class="plot" style="height:310px"></div><p class="small muted">A single recorded complaint in this dataset does not prove that the person is a new customer.</p></article><article class="card"><h2 class="section-title" style="margin-top:0">Complaint volume by customer group</h2><div id="customer-volume-plot" class="plot" style="height:310px"></div><p class="small muted">Repeat-customer volume counts all complaint rows belonging to customers with more than one recorded complaint.</p></article></section><h2 class="section-title">Customer details</h2><div class="card"><div class="toolbar"><div class="field"><label for="customer-search">Search customers</label><input id="customer-search" placeholder="Customer ID or saved name"></div><div class="field"><label for="customer-picker">Select a customer to edit</label><select id="customer-picker"></select></div></div><div id="customer-table" class="table-wrap" style="margin-top:16px"></div><div id="edit-customer" style="margin-top:22px"></div><div data-status></div></div><p class="small muted">The customer counts are calculated from the repository dataset. Customer names, contact fields, and notes are saved only in your signed-in account. Complaint text is not displayed.</p>`;
    const plotLayout={font:{family:"DM Sans, sans-serif",color:"#355365"},paper_bgcolor:"#ffffff",plot_bgcolor:"#ffffff",margin:{l:48,r:18,t:22,b:58},xaxis:{title:{text:""},showgrid:false,automargin:true},yaxis:{title:{text:"Customers"},rangemode:"tozero",gridcolor:"#e8eef0",automargin:true},showlegend:false,autosize:true};
    const plotConfig={responsive:true,displaylogo:false,modeBarButtonsToRemove:["lasso2d","select2d"]};
    Plotly.react(page.querySelector("#customer-cohort-plot"),[{type:"bar",x:["One recorded complaint","Repeat complainants"],y:[one,repeat],marker:{color:["#50ad91","#669de0"]},hovertemplate:"%{x}<br>Customers: %{y:,}<extra></extra>"}],{...plotLayout,title:{text:"Customers by complaint history",font:{size:15,color:"#183c42"}}},plotConfig);
    Plotly.react(page.querySelector("#customer-volume-plot"),[{type:"bar",x:["One recorded complaint","Repeat customers"],y:[one,repeatVolume],marker:{color:["#50ad91","#669de0"]},hovertemplate:"%{x}<br>Complaint rows: %{y:,}<extra></extra>"}],{...plotLayout,title:{text:"Recorded complaint rows",font:{size:15,color:"#183c42"}},yaxis:{...plotLayout.yaxis,title:{text:"Complaint rows"}}},plotConfig);
    const picker=page.querySelector("#customer-picker");picker.innerHTML=customerRows.map(row=>{const profile=profileByRef.get(row.customer_id);return `<option value="${escapeHtml(row.customer_id)}">${escapeHtml(profile?.display_name||row.customer_id)} · ${row.total_complaints} complaint(s)</option>`;}).join("");
    const drawTable=()=>{const query=page.querySelector("#customer-search").value.trim().toLowerCase();const rows=customerRows.filter(row=>!query||row.customer_id.toLowerCase().includes(query)||(profileByRef.get(row.customer_id)?.display_name||"").toLowerCase().includes(query)).slice(0,100);page.querySelector("#customer-table").innerHTML=`<table><thead><tr><th>Customer</th><th>Complaint group</th><th>Complaints</th><th>Most common category</th><th>Latest complaint</th></tr></thead><tbody>${rows.map(row=>{const profile=profileByRef.get(row.customer_id);return `<tr><td>${escapeHtml(profile?.display_name||row.customer_id)}</td><td><span class="badge ${row.total_complaints>1?"repeat":""}">${row.total_complaints>1?"Repeat":"One recorded"}</span></td><td>${row.total_complaints}</td><td>${escapeHtml(row.common_category||"—")}</td><td>${escapeHtml(row.last_complaint?new Date(row.last_complaint).toLocaleDateString():"—")}</td></tr>`;}).join("")}</tbody></table>`;};
    const drawEdit=()=>{const row=customerRows.find(item=>item.customer_id===picker.value);if(!row)return;const profile=profileByRef.get(row.customer_id)||{};page.querySelector("#edit-customer").innerHTML=`<h2 class="section-title">Edit customer</h2><p class="muted small">${escapeHtml(row.customer_id)} · ${row.total_complaints} recorded complaint(s) · ${escapeHtml(row.cohort)}</p><form id="edit-form" class="edit-grid"><div class="field"><label for="customer-name">Customer name</label><input id="customer-name" maxlength="120" value="${escapeHtml(profile.display_name||"")}"></div><div class="field"><label for="customer-email">Email (optional)</label><input id="customer-email" type="email" maxlength="254" value="${escapeHtml(profile.email||"")}"></div><div class="field"><label for="customer-phone">Phone (optional)</label><input id="customer-phone" maxlength="40" value="${escapeHtml(profile.phone||"")}"></div><div class="field wide"><label for="customer-notes">Private notes (optional)</label><textarea id="customer-notes" maxlength="1000" style="min-height:80px">${escapeHtml(profile.notes||"")}</textarea></div><div class="wide"><button class="button">Save customer details</button></div></form>`;page.querySelector("#edit-form").addEventListener("submit",async event=>{event.preventDefault();const save=event.currentTarget.querySelector("button");save.disabled=true;try{const {error}=await supabase.from("customer_profiles").upsert({owner_id:activeSession.user.id,customer_ref:row.customer_id,display_name:page.querySelector("#customer-name").value.trim()||null,email:page.querySelector("#customer-email").value.trim()||null,phone:page.querySelector("#customer-phone").value.trim()||null,notes:page.querySelector("#customer-notes").value.trim()||null},{onConflict:"owner_id,customer_ref"});if(error)throw error;profileByRef.set(row.customer_id,{customer_ref:row.customer_id,display_name:page.querySelector("#customer-name").value.trim(),email:page.querySelector("#customer-email").value.trim(),phone:page.querySelector("#customer-phone").value.trim(),notes:page.querySelector("#customer-notes").value.trim()});showNotice("Customer details saved to your private workspace.");drawTable();}catch(error){showNotice(error.message,"error");}finally{save.disabled=false;}});};
    page.querySelector("#customer-search").addEventListener("input",drawTable);picker.addEventListener("change",drawEdit);drawTable();drawEdit();
  }catch(error){page.innerHTML=hero("Customer workspace","Customer information is protected behind sign-in.")+`<article class="card"><div class="notice error">${escapeHtml(error.message)}</div><p class="muted small">If you just created the database table, refresh this page after Supabase finishes exposing it through the Data API.</p></article>`;}
}

async function apiGet(path){const response=await fetch(path,{headers:{Authorization:`Bearer ${activeSession.access_token}`}});const data=await response.json();if(!response.ok)throw new Error(data.detail||"Could not load this section.");return data;}

function parseCsv(text){const rows=[];let row=[],field="",quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}else if(ch==='"')quoted=true;else if(ch===","){row.push(field);field="";}else if(ch==="\n"){row.push(field.replace(/\r$/,""));if(row.some(value=>value!==""))rows.push(row);row=[];field="";}else field+=ch;}if(field!==""||row.length){row.push(field.replace(/\r$/,""));if(row.some(value=>value!==""))rows.push(row);}return rows;}
function csvCell(value){const text=String(value??"");return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}

function renderBatch(){
  const page=root.querySelector("#page");
  page.innerHTML=hero("Batch analysis","Upload a CSV, choose the complaint text column, and download the same rows enriched with model results.")+`<section class="card"><div class="field"><label for="batch-file">CSV file</label><input id="batch-file" type="file" accept=".csv,text/csv"></div><div id="batch-options"></div><div id="batch-status" class="muted small"></div><div id="batch-preview"></div></section>`;
  page.querySelector("#batch-file").addEventListener("change",async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      const rows=parseCsv(await file.text());if(rows.length<2)throw new Error("The CSV needs a header row and at least one complaint.");
      const headers=rows[0];
      page.querySelector("#batch-options").innerHTML=`<div class="toolbar"><div class="field"><label for="batch-column">Complaint text column</label><select id="batch-column">${headers.map((h,i)=>`<option value="${i}">${escapeHtml(h||`Column ${i+1}`)}</option>`).join("")}</select></div><div class="field"><label for="batch-language">Language</label><select id="batch-language"><option>Auto detect</option><option>English</option><option>Hinglish</option><option>Hindi</option><option>Tamil</option><option>Telugu</option><option>Kannada</option><option>Malayalam</option><option>Bengali</option><option>Gujarati</option><option>Punjabi</option><option>Other / unsure</option></select></div><label class="field"><span>English translation</span><span><input id="batch-translate" type="checkbox"> Also translate to English</span></label></div><p class="muted small">${rows.length-1} data rows detected. The uploaded file is processed for this session and is not saved to the app.</p><div class="actions"><button class="button" id="run-batch">Analyze ${rows.length-1} rows</button><button class="button secondary" id="download-batch" disabled>Download results CSV</button></div>`;
      page.querySelector("#run-batch").addEventListener("click",async()=>{
        const run=page.querySelector("#run-batch"),download=page.querySelector("#download-batch"),status=page.querySelector("#batch-status"),column=Number(page.querySelector("#batch-column").value),language=page.querySelector("#batch-language").value,translate=page.querySelector("#batch-translate").checked;
        run.disabled=true;download.disabled=true;run.textContent="Analyzing…";const enriched=[...rows[0],"predicted_category","detected_language","top_category_signals","sentiment","suggested_priority","subcategory","english_translation","analysis_status"];let done=0;status.textContent=`Analyzed 0 of ${rows.length-1} rows`;const results=new Array(rows.length-1);let next=0;
        async function worker(){while(true){const index=next++;if(index>=rows.length-1)return;const input=rows[index+1];try{const response=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${activeSession.access_token}`},body:JSON.stringify({text:input[column]||"",language,translate})});const result=await response.json();if(!response.ok)throw new Error(result.detail||"Request failed");results[index]=[...input,result.category||"Manual review",result.language||"",(result.top_features||[]).join("; "),result.sentiment||"",result.priority||"",result.subcategory||"",result.translated||"",result.supported?"Complete":"Manual review"];}catch(error){results[index]=[...input,"Manual review","","","","","","",error.message||"Failed"];}done++;status.textContent=`Analyzed ${done} of ${rows.length-1} rows`;}}
        await Promise.all(Array.from({length:Math.min(4,rows.length-1)},worker));const output=[enriched,...results].map(row=>row.map(csvCell).join(",")).join("\r\n"),blob=new Blob(["\ufeff",output],{type:"text/csv;charset=utf-8"});download.disabled=false;download.onclick=()=>{const url=URL.createObjectURL(blob),anchor=document.createElement("a");anchor.href=url;anchor.download=`${file.name.replace(/\.csv$/i,"")}_analyzed.csv`;anchor.click();URL.revokeObjectURL(url);};
        page.querySelector("#batch-preview").innerHTML=`<h2 class="section-title">Preview of predictions</h2><div class="table-wrap"><table><thead><tr>${enriched.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${results.slice(0,8).map(row=>`<tr>${row.map(value=>`<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;run.disabled=false;run.textContent="Analyze again";
      });
    }catch(error){page.querySelector("#batch-status").innerHTML=`<span class="notice error">${escapeHtml(error.message)}</span>`;}
  });
}

async function renderInsights(){
  const page=root.querySelector("#page");
  page.innerHTML=hero("Complaint insights","Explore the same interactive charts and aggregate trends as the Streamlit dashboard.")+`<div class="loading-inline">Loading aggregate patterns…</div>`;
  try{
    if(!window.Plotly)throw new Error("Interactive charts could not load. Refresh the page or check your internet connection.");
    const data=await apiGet("/api/insights"),monthly=data.monthly||[],subcategories=data.subcategories||[],marginals=data.marginals||[];
    const options={month:[...new Set(monthly.map(row=>row.month))].sort(),category:[...new Set(monthly.map(row=>row.category))].sort(),language:[...new Set(monthly.map(row=>row.language))].sort()};
    const plurals={month:"months",category:"categories",language:"languages"};
    const filter=(key,label)=>`<details class="multi-filter" data-filter="${key}"><summary>All ${plurals[key]}</summary><div class="filter-options">${options[key].map(value=>`<label><input type="checkbox" value="${escapeHtml(value)}"><span>${escapeHtml(value)}</span></label>`).join("")}</div></details>`;
    page.innerHTML=hero("Complaint insights","Explore the same interactive charts and aggregate trends as the Streamlit dashboard.")+`<section class="card insight-filter-card"><div class="filter-grid">${filter("month","Month")}${filter("category","Category")}${filter("language","Language")}</div></section><section class="grid metrics insight-metrics" id="insight-metrics"></section><section class="grid two-col insight-charts"><article class="card plot-card"><div id="plot-category" class="plot"></div></article><article class="card plot-card"><div id="plot-language" class="plot"></div></article><article class="card plot-card"><div id="plot-sunburst" class="plot"></div></article><article class="card plot-card"><div id="plot-priority" class="plot"></div></article><article class="card plot-card plot-wide"><div id="plot-sentiment" class="plot"></div></article></section><p class="small muted">Category and language plots respond to the filters. The sunburst, priority, and sentiment plots show the grouped overall counts, matching the Streamlit dashboard.</p>`;
    const set2=["#66C2A5","#FC8D62","#8DA0CB","#E78AC3","#A6D854","#FFD92F","#E5C494","#B3B3B3"],pastel=["#A1C9F4","#FFB482","#8DE5A1","#FF9F9B","#D0BBFF","#DEBB9B","#FAB0E4","#CFCFCF","#FFFEA3","#B9F2F0"],qualitative=["#636EFA","#EF553B","#00CC96","#AB63FA","#FFA15A","#19D3F3","#FF6692","#B6E880","#FF97FF","#FECB52"];
    const sum=rows=>rows.reduce((total,row)=>total+Number(row.complaint_count||0),0);
    const group=(rows,key)=>{const values=new Map();rows.forEach(row=>values.set(row[key],(values.get(row[key])||0)+Number(row.complaint_count||0)));return [...values].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count);};
    const checked=key=>[...page.querySelectorAll(`[data-filter="${key}"] input:checked`)].map(input=>input.value);
    const makeBar=(target,rows,title,palette)=>{
      const labels=rows.map(row=>row.label),values=rows.map(row=>row.count),colors=rows.map((_,index)=>palette[index%palette.length]);
      const trace={type:"bar",x:labels,y:values,marker:{color:colors},hovertemplate:"%{x}<br>Complaints: %{y:,}<extra></extra>"};
      const layout={title:{text:title,font:{size:16,color:"#183c42"}},font:{family:"DM Sans, sans-serif",color:"#355365"},paper_bgcolor:"#ffffff",plot_bgcolor:"#ffffff",margin:{l:48,r:16,t:54,b:60},xaxis:{title:{text:""},tickangle:-25,automargin:true,showgrid:false},yaxis:{title:{text:"Complaint count"},rangemode:"tozero",gridcolor:"#e8eef0",automargin:true},showlegend:false,autosize:true};
      Plotly.react(target,[trace],layout,{responsive:true,displaylogo:false,modeBarButtonsToRemove:["lasso2d","select2d"]});
    };
    const draw=()=>{
      const chosen={month:checked("month"),category:checked("category"),language:checked("language")};
      for(const key of Object.keys(chosen)){const detail=page.querySelector(`[data-filter="${key}"]`),singular=chosen[key].length===1?key.slice(0,1).toUpperCase()+key.slice(1,key==="category"?8:undefined):plurals[key];detail.querySelector("summary").textContent=chosen[key].length?`${chosen[key].length} ${singular} selected`:`All ${plurals[key]}`;}
      const view=monthly.filter(row=>(!chosen.month.length||chosen.month.includes(row.month))&&(!chosen.category.length||chosen.category.includes(row.category))&&(!chosen.language.length||chosen.language.includes(row.language)));
      const count=sum(view),categoryCount=count?new Set(view.map(row=>row.category)).size:0,languageCount=count?new Set(view.map(row=>row.language)).size:0;
      page.querySelector("#insight-metrics").innerHTML=[metric("Complaints in selection",count.toLocaleString()),metric("Categories represented",categoryCount),metric("Languages represented",languageCount)].join("");
      makeBar(page.querySelector("#plot-category"),group(view,"category"),"Complaints by category",set2);
      makeBar(page.querySelector("#plot-language"),group(view,"language"),"Complaints by language",pastel);
      const subview=subcategories.filter(row=>!chosen.category.length||chosen.category.includes(row.category));
      const childGroups=group(subview,"category");
      const categoryTotals=new Map(childGroups.map(row=>[row.label,row.count]));
      const labels=[...categoryTotals.keys(),...subview.map(row=>row.sub_category)],parents=[...categoryTotals.keys().map(()=>""),...subview.map(row=>row.category)],values=[...categoryTotals.values(),...subview.map(row=>Number(row.complaint_count||0))];
      const sunburstTrace={type:"sunburst",labels,parents,values,branchvalues:"total",sort:true,insidetextorientation:"radial",hovertemplate:"%{label}<br>Complaints: %{value:,}<extra></extra>",marker:{colors:[...categoryTotals.keys().map((_,index)=>set2[index%set2.length]),...subview.map(row=>set2[[...categoryTotals.keys()].indexOf(row.category)%set2.length])],line:{color:"white",width:1}}};
      Plotly.react(page.querySelector("#plot-sunburst"),[sunburstTrace],{title:{text:"Category → subcategory (overall counts)",font:{size:16,color:"#183c42"}},font:{family:"DM Sans, sans-serif",color:"#355365"},paper_bgcolor:"#ffffff",margin:{l:8,r:8,t:54,b:8},autosize:true},{responsive:true,displaylogo:false});
      makeBar(page.querySelector("#plot-priority"),group(marginals.filter(row=>row.dimension==="priority"),"value"),"Priority mix (overall counts)",qualitative);
      makeBar(page.querySelector("#plot-sentiment"),group(marginals.filter(row=>row.dimension==="sentiment"),"value"),"Sentiment mix (overall counts)",qualitative);
    };
    page.querySelectorAll(".multi-filter input").forEach(input=>input.addEventListener("change",draw));draw();
  }catch(error){page.innerHTML=hero("Complaint insights","Explore the supplied aggregate dataset.")+`<article class="card"><div class="notice error">${escapeHtml(error.message)}</div></article>`;}
}

async function renderAbout(){
  const page=root.querySelector("#page");page.innerHTML=hero("About the model","How this multilingual complaint analyzer works and where to use human review.")+`<div class="loading-inline">Loading model card…</div>`;
  try{const data=await apiGet("/api/overview");page.innerHTML=hero("About the model","How this multilingual complaint analyzer works and where to use human review.")+`<section class="grid metrics">${metric("Complaint categories",data.categories.length,"Trained labels")}${metric("Supported languages",data.supported_languages.length,data.supported_languages.join(", "))}${metric("Held-out accuracy",`${(data.test_accuracy*100).toFixed(1)}%`,"Model test split")}${metric("Held-out macro-F1",`${(data.test_macro_f1*100).toFixed(1)}%`,"Unweighted average across categories")}</section><section class="grid two-col"><article class="card"><h2 class="section-title" style="margin-top:0">Analysis pipeline</h2><ol class="pipeline"><li>Read the customer message and selected or detected language.</li><li>Normalize text, then apply the trained TF-IDF text representation.</li><li>Predict complaint category and related subcategory, sentiment, and priority.</li><li>Show up to four words that contributed to the category prediction.</li><li>Optionally translate the message to English for review.</li></ol></article><article class="card"><h2 class="section-title" style="margin-top:0">Categories</h2><div class="signal-list">${data.categories.map(label=>`<span class="signal">${escapeHtml(label)}</span>`).join("")}</div><h2 class="section-title">Supported languages</h2><div class="signal-list">${data.supported_languages.map(label=>`<span class="signal">${escapeHtml(label)}</span>`).join("")}</div></article></section><section class="card" style="margin-top:16px"><h2 class="section-title" style="margin-top:0">How to interpret results</h2><p>Category signals are words from the input that contributed positively to the selected category under the model. They are a compact explanation, not proof of causality. Suggested priority and sentiment are model outputs and need confirmation for urgent, sensitive, or low-confidence cases.</p><p class="muted">Translation is optional and may be unavailable. Text in unsupported languages is routed for manual review. Dataset insights are aggregate counts and customer profiles are private to the signed-in account.</p></section>`;}catch(error){page.innerHTML=hero("About the model","Model information")+`<article class="card"><div class="notice error">${escapeHtml(error.message)}</div></article>`;}
}

initialize();
