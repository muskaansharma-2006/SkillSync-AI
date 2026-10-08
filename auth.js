const AUTH_API = `${typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : (window.API_BASE_URL || 'http://127.0.0.1:3000')}/api/auth`;

function getSanitizedToken() {
  const t = localStorage.getItem("skillsync_token");
  if (!t || t === "null" || t === "undefined" || t.trim() === "") return null;
  return t;
}

// Check if user is already logged in when visiting auth page with a return destination
(() => {
  const token = getSanitizedToken();
  if (!token) {
    localStorage.removeItem("skillsync_token");
    localStorage.removeItem("skillsync_user");
    return;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get("returnTo");
  if (!returnTo) {
    // Stay on auth.html unless the user was explicitly redirected with returnTo
    return;
  }

  const baseUrl = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : (window.API_BASE_URL || ''));
  fetch(`${baseUrl.replace(/\/$/, '')}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include"
  }).then(async res => {
    if (res.ok) {
      const result = await res.json().catch(() => ({}));
      if (result.data && result.data.id) {
        window.SkillSyncAuth = result.data;
        localStorage.setItem("skillsync_user", JSON.stringify(result.data));
        window.location.replace(returnTo);
      } else {
        localStorage.removeItem("skillsync_token");
        localStorage.removeItem("skillsync_user");
      }
    } else {
      localStorage.removeItem("skillsync_token");
      localStorage.removeItem("skillsync_user");
    }
  }).catch(() => {
    localStorage.removeItem("skillsync_token");
    localStorage.removeItem("skillsync_user");
  });
})();

const loginPanel = document.getElementById("loginPanel");
const signupPanel = document.getElementById("signupPanel");
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const feedback = document.getElementById("authFeedback");

function showPanel(panel) {
  const signup = panel === "signup";
  loginPanel.hidden = signup;
  signupPanel.hidden = !signup;
  loginTab.classList.toggle("active", !signup);
  signupTab.classList.toggle("active", signup);
  feedback.hidden = true;
}

function showFeedback(message, type = "error") {
  feedback.textContent = message;
  feedback.className = `auth-feedback ${type}`;
  feedback.hidden = false;
}

function clearErrors(form) {
  form.querySelectorAll(".field-error").forEach(error => { error.textContent = ""; });
}

function setLoading(form, loading) {
  const submit = form.querySelector("button[type=submit]");
  if (!submit) return;
  submit.disabled = loading;
  submit.classList.toggle("is-loading", loading);
  submit.querySelector("span").textContent = loading ? "Please wait..." : (form.id === "loginForm" ? "Login" : "Create Account");
}

function saveSession(data) {
  if (data?.session?.access_token) {
    localStorage.setItem("skillsync_token", data.session.access_token);
  }
  if (data?.user) {
    window.SkillSyncAuth = data.user;
    localStorage.setItem("skillsync_user", JSON.stringify(data.user));
  }
  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get("returnTo");
  const destination = returnTo || (data.user?.role === "recruiter" ? "recruiter.html" : "index.html");
  window.location.href = destination;
}

async function sendAuth(path, payload) {
  const baseUrl = typeof getApiBaseUrl === 'function' ? getApiBaseUrl() : (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : (window.API_BASE_URL || ''));
  const url = `${baseUrl.replace(/\/$/, '')}/api/auth/${path}`;
  const token = getSanitizedToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(url, { method: "POST", credentials: "include", headers, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "We could not complete that request.");
  return data.data;
}

loginTab.addEventListener("click", () => showPanel("login"));
signupTab.addEventListener("click", () => showPanel("signup"));
document.getElementById("switchToSignup").addEventListener("click", () => showPanel("signup"));
document.getElementById("switchToLogin").addEventListener("click", () => showPanel("login"));
document.getElementById("forgotPassword").addEventListener("click", () => showFeedback("Password reset will be available once email delivery is connected.", "info"));
document.getElementById("googleLogin").addEventListener("click", () => showFeedback("Google sign-in is ready for OAuth configuration and is not required for the demo.", "info"));

document.querySelectorAll(".password-toggle").forEach(button => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
    button.innerHTML = `<i class="fa-regular fa-eye${visible ? "" : "-slash"}"></i>`;
  });
});

function sanitizeEmail(emailStr) {
  return (emailStr || '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
}

function isValidEmail(emailStr) {
  const clean = sanitizeEmail(emailStr);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(clean);
}

// Real-time Confirm Password validation
const signupPasswordInput = document.getElementById("signupPassword");
const signupConfirmPasswordInput = document.getElementById("signupConfirmPassword");

if (signupConfirmPasswordInput && signupPasswordInput) {
  const validateConfirmMatch = () => {
    const errorEl = document.getElementById("signupConfirmPasswordError");
    if (!errorEl) return;
    if (!signupConfirmPasswordInput.value) {
      errorEl.textContent = "";
    } else if (signupConfirmPasswordInput.value !== signupPasswordInput.value) {
      errorEl.textContent = "Passwords do not match";
    } else {
      errorEl.textContent = "";
    }
  };

  signupConfirmPasswordInput.addEventListener("input", validateConfirmMatch);
  signupPasswordInput.addEventListener("input", () => {
    if (signupConfirmPasswordInput.value) {
      validateConfirmMatch();
    }
  });
}

// Clear inline errors as user types
document.getElementById("signupName")?.addEventListener("input", (e) => {
  const val = e.target.value.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
  if (val.length >= 2) {
    const err = document.getElementById("signupNameError");
    if (err) err.textContent = "";
  }
});

document.getElementById("signupEmail")?.addEventListener("input", (e) => {
  if (isValidEmail(e.target.value)) {
    const err = document.getElementById("signupEmailError");
    if (err) err.textContent = "";
  }
});

document.getElementById("signupPassword")?.addEventListener("input", (e) => {
  if (e.target.value.length >= 6) {
    const err = document.getElementById("signupPasswordError");
    if (err) err.textContent = "";
  }
});

document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  clearErrors(form);
  const emailInput = document.getElementById("loginEmail");
  const passwordInput = document.getElementById("loginPassword");
  const rawEmail = emailInput ? emailInput.value : "";
  const email = sanitizeEmail(rawEmail);
  const password = passwordInput ? passwordInput.value : "";
  
  if (!email) {
    const err = document.getElementById("loginEmailError");
    if (err) err.textContent = "Enter your email.";
  }
  if (!password) {
    const err = document.getElementById("loginPasswordError");
    if (err) err.textContent = "Enter your password.";
  }
  if (!email || !password) return;
  setLoading(form, true);
  try { saveSession(await sendAuth("login", { email, password })); }
  catch (error) { showFeedback(error.message); setLoading(form, false); }
});

document.getElementById("signupForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  clearErrors(form);

  const rawName = document.getElementById("signupName").value;
  const full_name = rawName.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
  const rawEmail = document.getElementById("signupEmail").value;
  const email = sanitizeEmail(rawEmail);
  const password = document.getElementById("signupPassword").value;
  const confirm = document.getElementById("signupConfirmPassword").value;
  const roleElement = document.querySelector("input[name=signupRole]:checked");
  const role = roleElement ? roleElement.value : "";
  let valid = true;

  // 1. Full Name validation
  if (!full_name || full_name.length < 2) {
    document.getElementById("signupNameError").textContent = "Please enter your full name";
    valid = false;
  }

  // 2. Email format validation
  if (!email || !isValidEmail(email)) {
    document.getElementById("signupEmailError").textContent = "Please enter a valid email address";
    valid = false;
  }

  // 3. Password validation (Minimum 6 characters)
  if (!password || password.length < 6) {
    document.getElementById("signupPasswordError").textContent = "Password must be at least 6 characters";
    valid = false;
  }

  // 4. Confirm Password validation
  if (!confirm || confirm !== password) {
    document.getElementById("signupConfirmPasswordError").textContent = "Passwords do not match";
    valid = false;
  }

  // 5. Role safety check
  if (!role || !["candidate", "recruiter"].includes(role)) {
    const roleErr = document.getElementById("signupRoleError");
    if (roleErr) roleErr.textContent = "Please select a role";
    valid = false;
  }

  if (!valid) return;

  setLoading(form, true);
  try {
    saveSession(await sendAuth("signup", { name: full_name, full_name, email, password, role }));
  } catch (error) {
    showFeedback(error.message);
    setLoading(form, false);
  }
});
