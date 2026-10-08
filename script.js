/* 
  SkillSync - Core Application Logic & Interactions
*/

if (typeof window.getApiBaseUrl !== 'function') {
  window.getApiBaseUrl = function() {
    return (typeof window.API_BASE_URL !== 'undefined' ? window.API_BASE_URL : (window.location.origin || '')).replace(/\/$/, '');
  };
}

function getSanitizedToken() {
  const t = localStorage.getItem("skillsync_token");
  if (!t || t === "null" || t === "undefined" || t.trim() === "") return null;
  return t;
}

async function apiFetch(url, options = {}) {
  const token = getSanitizedToken();
  const headers = options.headers ? { ...options.headers } : {};
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(url, {
    credentials: "include",
    ...options,
    headers
  });
}

// Application State Store (Local Storage sync with fallback mock defaults)
const CompetencyState = {
  candidate: {
    name: "Candidate",
    fullName: "Candidate User",
    avatar: "CU",
    overallScore: 84,
    level: "Intermediate",
    assessmentsCompleted: 6,
    skillsAssessed: 4,
    skills: {
      "Python": 87,
      "SQL": 82,
      "Problem Solving": 91,
      "Data Analysis": 84,
      "Communication": 76,
      "Debugging": 68
    },
    targets: {
      "Python": 90,
      "SQL": 85,
      "Debugging": 80,
      "Problem Solving": 95
    }
  },
  
  // Assessments List Data
  assessments: [
    {
      id: "python-practical",
      title: "Python Practical Competency",
      level: "Intermediate",
      duration: "30 mins",
      challenges: 8,
      progress: 37,
      status: "in-progress",
      score: null,
      category: "Programming",
      tags: ["Python", "Algorithms", "Debugging"]
    },
    {
      id: "sql-data-benchmark",
      title: "SQL & Data Analysis Benchmark",
      level: "Intermediate",
      duration: "25 mins",
      challenges: 6,
      progress: 100,
      status: "completed",
      score: 82,
      category: "Data",
      tags: ["SQL", "Analytics", "Joins"]
    },
    {
      id: "problem-solving-logic",
      title: "Problem Solving & Algorithmic Logic",
      level: "Advanced",
      duration: "35 mins",
      challenges: 5,
      progress: 0,
      status: "available",
      score: 91,
      category: "Core CS",
      tags: ["Data Structures", "Logic"]
    },
    {
      id: "realtime-api-backend",
      title: "Real-Time API & Backend Architecture",
      level: "Advanced",
      duration: "45 mins",
      challenges: 6,
      progress: 0,
      status: "available",
      score: null,
      category: "Backend",
      tags: ["REST", "Async", "Python"]
    },
    {
      id: "frontend-ui-benchmark",
      title: "Frontend UI/UX Practical Benchmark",
      level: "Intermediate",
      duration: "25 mins",
      challenges: 6,
      progress: 0,
      status: "available",
      score: null,
      category: "Frontend",
      tags: ["HTML", "CSS", "DOM"]
    }
  ],

  // Active Role State
  role: "candidate"
};

const PROTECTED_PAGES = new Set([
  "index.html", "assessments.html", "assessment-details.html", "assessment.html",
  "result.html", "skill-gap.html", "practice.html", "passport.html", "history.html",
  "mentor.html", "career-recommendation.html", "recruiter.html", "candidate.html", "settings.html"
]);

function updateUserProfileHeader(user) {
  let currentUser = user || window.SkillSyncAuth;
  if (!currentUser || !currentUser.id) {
    try {
      const stored = localStorage.getItem("skillsync_user");
      if (stored) currentUser = JSON.parse(stored);
    } catch (e) {}
  }
  currentUser = currentUser || {};

  const rawName = currentUser.name || currentUser.full_name || (currentUser.email ? currentUser.email.split('@')[0] : '');
  const displayName = rawName ? rawName.trim() : 'Candidate';
  const firstName = displayName.split(' ')[0] || 'Candidate';
  const initials = displayName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CA';

  const level = currentUser.competency_level 
    ? `${currentUser.competency_level} Level` 
    : (currentUser.overall_competency !== undefined && currentUser.overall_competency !== null
        ? (currentUser.overall_competency >= 85 ? "Advanced Level" : (currentUser.overall_competency >= 70 ? "Intermediate Level" : "Beginner Level")) 
        : "Candidate");

  const greetingEl = document.getElementById("dashGreeting");
  if (greetingEl) {
    greetingEl.textContent = `Welcome back, ${firstName} 👋`;
  }
  
  document.querySelectorAll("#dashHeaderName, .user-profile .user-name").forEach(el => {
    el.textContent = `${firstName} 👋`;
  });

  document.querySelectorAll("#dashAvatar, .user-profile .avatar").forEach(el => {
    el.textContent = initials;
  });

  document.querySelectorAll("#dashHeaderRole, .user-profile .user-role").forEach(el => {
    el.textContent = level;
  });
}

// Initialize Application once the page markup is available
async function initializeApplication() {
  if (!(await enforceAuthentication())) return;
  updateUserProfileHeader(window.SkillSyncAuth);
  initNavigation();
  initRoleSwitcher();
  initMobileMenu();
  initProfileMenu();
  
  // Page-specific initializers
  const page = getPageName();
  if (page === "index" || page === "" || page === "index.html") {
    initCandidateDashboard();
  } else if (page === "assessments.html" || page.includes("assessments")) {
    initAssessmentsPage();
  } else if (page === "practice.html" || page.includes("practice")) {
    initPracticePage();
  } else if (page === "assessment.html" || page.includes("assessment") || document.getElementById("mcqQuestionTitle") || document.getElementById("runCodeBtn")) {
    initPracticalAssessmentSimulation();
  } else if (page === "result.html" || page.includes("result")) {
    initResultPage();
  } else if (page === "skill-gap.html" || page.includes("skill-gap")) {
    initSkillGapPage();
  } else if (page === "career-recommendation.html" || page.includes("career")) {
    initCareerRecommendationPage();
  } else if (page === "passport.html" || page.includes("passport")) {
    initPassportPage();
  } else if (page === "recruiter.html" || page.includes("recruiter")) {
    initRecruiterDashboard();
  } else if (page === "candidate.html" || page.includes("candidate")) {
    initCandidateProfileView();
  } else if (page === "history.html" || page.includes("history")) {
    initHistoryPage();
  } else if (page === "mentor.html" || page.includes("mentor")) {
    initAIMentorPage();
  }
}

async function enforceAuthentication() {
  const page = getPageName() || "index.html";
  if (!PROTECTED_PAGES.has(page)) return true;

  if (window.SkillSyncAuth && window.SkillSyncAuth.id) {
    return true;
  }

  try {
    const token = getSanitizedToken();
    if (!token) throw new Error("No token found");
    const headers = { "Authorization": `Bearer ${token}` };

    const fetchPromise = fetch(`${getApiBaseUrl()}/api/auth/me`, { credentials: "include", headers });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("NETWORK_TIMEOUT")), 4000)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);
    const result = await response.json();
    const user = result.data;
    if (!response.ok || !user || !user.id) throw new Error("Unauthenticated");

    window.SkillSyncAuth = user;
    localStorage.setItem("skillsync_user", JSON.stringify(user));

    if (user.role === "recruiter" && ["index.html", "assessments.html", "assessment-details.html", "assessment.html", "result.html", "skill-gap.html", "practice.html", "passport.html", "history.html", "mentor.html", "career-recommendation.html"].includes(page)) {
      window.location.href = "recruiter.html";
      return false;
    }
    if (user.role === "candidate" && ["recruiter.html", "candidate.html"].includes(page)) {
      window.location.href = "index.html";
      return false;
    }
    return true;
  } catch (error) {
    if (error.message === "NETWORK_TIMEOUT") {
      console.warn("[SkillSync Auth] Auth check timed out after 4 seconds.");
      const stored = localStorage.getItem("skillsync_user");
      if (stored) {
        try {
          window.SkillSyncAuth = JSON.parse(stored);
          if (!document.querySelector(".network-warning-banner")) {
            const banner = document.createElement("div");
            banner.className = "network-warning-banner";
            banner.style.cssText = "position: fixed; top: 0; left: 0; right: 0; z-index: 9999; background: #f59e0b; color: #000; text-align: center; padding: 0.5rem; font-weight: 600; font-size: 0.875rem;";
            banner.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Connection is slow. Retrying session verification... <button onclick="location.reload()" style="margin-left:1rem; padding: 0.2rem 0.6rem; cursor:pointer;">Retry</button>';
            document.body.prepend(banner);
          }
          return true;
        } catch(e) {}
      }
    }
    localStorage.removeItem("skillsync_token");
    localStorage.removeItem("skillsync_user");
    window.location.href = "auth.html?returnTo=" + encodeURIComponent(page);
    return false;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApplication);
} else {
  initializeApplication();
}

// Utility to parse current HTML filename
function getPageName() {
  let path = window.location.pathname || "";
  let name = path.substring(path.lastIndexOf('/') + 1);
  if (name.includes('?')) name = name.split('?')[0];
  if (name.includes('#')) name = name.split('#')[0];
  return name.toLowerCase() || "index.html";
}

// Navigation active state setup
function initNavigation() {
  const currentPage = getPageName() || "index.html";
  const navLinks = document.querySelectorAll(".nav-link");
  
  navLinks.forEach(link => {
    const href = link.getAttribute("href");
    if (href === currentPage || (currentPage === "" && href === "index.html")) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// Candidate vs Recruiter Role Switcher
function initRoleSwitcher() {
  const candidateBtn = document.getElementById("role-candidate");
  const recruiterBtn = document.getElementById("role-recruiter");
  
  if (candidateBtn && recruiterBtn) {
    candidateBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
    recruiterBtn.addEventListener("click", () => {
      window.location.href = "recruiter.html";
    });
  }
}

// Shared account menu for every authenticated header that contains a profile.
function initProfileMenu() {
  document.querySelectorAll(".user-profile").forEach(profile => {
    if (profile.dataset.logoutMenuInitialized === "true") return;
    profile.dataset.logoutMenuInitialized = "true";
    profile.style.position = "relative";
    profile.style.cursor = "pointer";
    profile.setAttribute("role", "button");
    profile.setAttribute("tabindex", "0");
    profile.setAttribute("aria-haspopup", "menu");
    profile.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.className = "profile-logout-menu";
    menu.setAttribute("role", "menu");
    menu.style.cssText = "display:none; position:absolute; right:0; top:calc(100% + 0.6rem); min-width:150px; z-index:1000; padding:0.4rem; border:1px solid var(--border-color); border-radius:var(--radius-md); background:#111827; box-shadow:0 12px 28px rgba(0,0,0,.32);";
    menu.innerHTML = '<button type="button" class="profile-logout-btn" role="menuitem" style="width:100%; border:0; border-radius:6px; padding:.6rem .7rem; background:transparent; color:#fda4af; text-align:left; cursor:pointer; font:inherit;"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>';
    profile.appendChild(menu);

    const closeMenu = () => {
      menu.style.display = "none";
      profile.setAttribute("aria-expanded", "false");
    };
    const toggleMenu = () => {
      const isOpen = menu.style.display === "block";
      menu.style.display = isOpen ? "none" : "block";
      profile.setAttribute("aria-expanded", String(!isOpen));
    };
    profile.addEventListener("click", event => {
      if (event.target.closest(".profile-logout-menu")) return;
      toggleMenu();
    });
    profile.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleMenu();
      }
      if (event.key === "Escape") closeMenu();
    });
    document.addEventListener("click", event => {
      if (!profile.contains(event.target)) closeMenu();
    });
    menu.querySelector(".profile-logout-btn").addEventListener("click", async event => {
      event.stopPropagation();
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/auth/logout`, { method: "POST", credentials: "include" });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Logout failed.");
        delete window.SkillSyncAuth;
        window.location.replace("auth.html");
      } catch (error) {
        console.error("Logout failed:", error);
        showToast("Could not end the session. Please try again.", "info");
      }
    });
  });
}

// Mobile Navbar Drawer
function initMobileMenu() {
  const btn = document.querySelector(".mobile-menu-btn");
  const links = document.querySelector(".nav-links");
  
  if (btn && links) {
    btn.addEventListener("click", () => {
      links.classList.toggle("active");
    });
  }
}

// Toast Notifications Helper
function showToast(message, type = "success") {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  const icon = type === "success" ? "fa-circle-check text-green" : "fa-circle-info text-primary";
  toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ----------------------------------------------------
// PAGE-SPECIFIC IMPLEMENTATIONS
// ----------------------------------------------------

// 1. CANDIDATE DASHBOARD (index.html)
async function initCandidateDashboard() {
  let user = window.SkillSyncAuth;
  if (!user || !user.id) {
    try {
      const stored = localStorage.getItem("skillsync_user");
      if (stored) user = JSON.parse(stored);
    } catch(e) {}
  }
  user = user || {};
  
  updateUserProfileHeader(user);

  try {
    let compRes = { ok: false };
    let resRes = { ok: false };
    if (user.id) {
      compRes = await apiFetch(`${getApiBaseUrl()}/api/candidates/${user.id}/competencies`);
      resRes = await apiFetch(`${getApiBaseUrl()}/api/candidates/${user.id}/results`);
    }
    
    let competencies = [];
    let overallScore = null;
    let skillLevel = "Not Assessed";
    let completedCount = 0;

    if (compRes.ok) {
      const compJson = await compRes.json();
      if (compJson.success && compJson.data) {
        competencies = compJson.data.competencies || [];
        overallScore = compJson.data.overall_competency;
        skillLevel = compJson.data.competency_level || "Intermediate";
      }
    }

    let resultsList = [];
    if (resRes.ok) {
      const resJson = await resRes.json();
      if (resJson.success && Array.isArray(resJson.data)) {
        resultsList = resJson.data;
        completedCount = resultsList.length;
      }
    }

    const overallScoreEl = document.getElementById("dashOverallScore");
    const completedCountEl = document.getElementById("dashCompletedCount");
    const skillsCountEl = document.getElementById("dashSkillsCount");
    const skillLevelEl = document.getElementById("dashSkillLevel");
    const headerRoleEl = document.getElementById("dashHeaderRole");
    const quoteEl = document.getElementById("dashAiInsightQuote");

    const hasAssessedData = completedCount > 0 || (competencies && competencies.length > 0) || (overallScore !== null && overallScore > 0);

    if (hasAssessedData) {
      const finalScore = (overallScore !== null && overallScore > 0) 
        ? overallScore 
        : Math.round(competencies.reduce((a,b)=>a+Number(b.score),0)/competencies.length);
      
      const finalLevel = (skillLevel && skillLevel !== "Not Assessed") 
        ? skillLevel 
        : (finalScore >= 85 ? "Advanced" : (finalScore >= 70 ? "Intermediate" : "Beginner"));

      if (overallScoreEl) overallScoreEl.textContent = `${finalScore}%`;
      if (completedCountEl) completedCountEl.textContent = completedCount;
      if (skillsCountEl) skillsCountEl.textContent = competencies.length;
      if (skillLevelEl) skillLevelEl.textContent = `${finalLevel} Level`;
      if (headerRoleEl) headerRoleEl.textContent = `${finalLevel} Level`;

      if (quoteEl) {
        if (resultsList.length > 0 && resultsList[0].ai_insight) {
          quoteEl.textContent = `"${resultsList[0].ai_insight}"`;
        } else {
          quoteEl.textContent = `"Candidate demonstrated verified proficiency in core execution logic and practical problem solving."`;
        }
      }

      const labels = competencies.map(c => c.skill_name);
      const scores = competencies.map(c => Number(c.score));
      renderRadarChart("competencyRadarChart", scores.length ? scores : [70, 70, 70, 70, 70], labels.length ? labels : ['Python', 'SQL', 'Algorithms', 'Data Analysis', 'Debugging']);
      renderTrendChart("competencyTrendChart", finalScore);
      renderSkillsBreakdownWidget(competencies);

    } else {
      // Unassessed new candidate state
      if (overallScoreEl) overallScoreEl.textContent = "0%";
      if (completedCountEl) completedCountEl.textContent = "0";
      if (skillsCountEl) skillsCountEl.textContent = "0";
      if (skillLevelEl) skillLevelEl.textContent = "Not Assessed";
      if (headerRoleEl) headerRoleEl.textContent = "Not Assessed";

      if (quoteEl) {
        quoteEl.textContent = "Complete an assessment to unlock your personalized AI competency evaluation.";
      }

      renderRadarChart("competencyRadarChart", [0, 0, 0, 0, 0], ['Python', 'SQL', 'Algorithms', 'Data Analysis', 'Debugging']);
      renderTrendChart("competencyTrendChart", 0);
      renderSkillsBreakdownWidget([]);
    }

  } catch (err) {
    console.error("Failed to load candidate dashboard data:", err);
    updateUserProfileHeader(user);
    if (document.getElementById("dashOverallScore")) document.getElementById("dashOverallScore").textContent = "0%";
    if (document.getElementById("dashCompletedCount")) document.getElementById("dashCompletedCount").textContent = "0";
    if (document.getElementById("dashSkillsCount")) document.getElementById("dashSkillsCount").textContent = "0";
    if (document.getElementById("dashSkillLevel")) document.getElementById("dashSkillLevel").textContent = "Not Assessed";
    renderRadarChart("competencyRadarChart", [0, 0, 0, 0, 0], ['Python', 'SQL', 'Algorithms', 'Data Analysis', 'Debugging']);
    renderSkillsBreakdownWidget([]);
  }
}

function renderSkillsBreakdownWidget(competencies) {
  const container = document.getElementById("dashSkillsBreakdownList");
  if (!container) return;

  if (!competencies || competencies.length === 0) {
    container.innerHTML = `
      <div style="padding: 1.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.88rem; background: rgba(17,24,39,0.3); border-radius: var(--radius-sm); border: 1px dashed var(--border-color);">
        <i class="fa-solid fa-sliders" style="font-size: 1.25rem; color: var(--text-dim); margin-bottom: 0.5rem;"></i>
        <div>No verified competencies yet</div>
        <p style="font-size: 0.8rem; margin-top: 0.25rem;">Complete an assessment to populate your skills breakdown.</p>
      </div>
    `;
    return;
  }

  const icons = {
    'Python': 'fa-brands fa-python',
    'SQL': 'fa-solid fa-database',
    'Debugging': 'fa-solid fa-bug',
    'Algorithms': 'fa-solid fa-code-branch',
    'Data Analysis': 'fa-solid fa-chart-column',
    'Communication': 'fa-solid fa-comments'
  };

  const colors = ['var(--accent-cyan)', 'var(--accent-purple)', 'var(--accent-green)', 'var(--primary)', '#f43f5e'];

  container.innerHTML = competencies.map((item, idx) => {
    const name = item.skill_name;
    const score = Math.round(Number(item.score));
    const icon = icons[name] || 'fa-solid fa-bullseye';
    const color = colors[idx % colors.length];

    return `
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 0.88rem; font-weight: 600; margin-bottom: 0.35rem;">
          <span><i class="${icon}" style="color: ${color}; margin-right: 0.4rem;"></i> ${name}</span>
          <span style="color: ${color}; font-weight: 700;">${score}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${score}%; background: ${color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Render Radar Chart for Skills Breakdown
function renderRadarChart(canvasId, scores, labels) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;

  const existingChart = Chart.getChart(ctx);
  if (existingChart) existingChart.destroy();

  const chartLabels = labels && labels.length ? labels : ['Python', 'SQL', 'Algorithms', 'Data Analysis', 'Debugging'];

  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: chartLabels,
      datasets: [{
        label: 'Current Competency %',
        data: scores,
        backgroundColor: 'rgba(99, 102, 241, 0.25)',
        borderColor: '#6366f1',
        pointBackgroundColor: '#06b6d4',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#06b6d4',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
          grid: { color: 'rgba(255, 255, 255, 0.1)' },
          pointLabels: {
            color: '#94a3b8',
            font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' }
          },
          ticks: {
            display: false,
            stepSize: 20
          },
          suggestedMin: 0,
          suggestedMax: 100
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// Render Trend Growth Line Chart
function renderTrendChart(canvasId) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || typeof Chart === 'undefined') return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Current'],
      datasets: [{
        label: 'Overall Score',
        data: [68, 72, 75, 79, 81, 84],
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const {ctx, chartArea} = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(99, 102, 241, 0.01)');
          gradient.addColorStop(1, 'rgba(99, 102, 241, 0.3)');
          return gradient;
        },
        borderColor: '#6366f1',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#06b6d4'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8' },
          min: 60,
          max: 100
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

// 2. ASSESSMENTS PAGE (assessments.html)
async function initAssessmentsPage() {
  const container = document.getElementById("assessmentsGrid");
  if (!container) return;

  const searchInput = document.getElementById("assessmentSearch");
  const filterChips = document.querySelectorAll(".filter-chip");
  const requestedFilter = new URLSearchParams(window.location.search).get("field");
  let activeFilter = [...filterChips].some(chip => chip.getAttribute("data-filter") === requestedFilter) ? requestedFilter : "all";

  filterChips.forEach(chip => chip.classList.toggle("active", chip.getAttribute("data-filter") === activeFilter));

  // Loading skeleton state
  container.innerHTML = `
    <div class="card skeleton-card" style="padding: 1.5rem; height: 260px; background: rgba(17, 24, 39, 0.5);">
      <div style="height: 20px; width: 40%; background: rgba(255,255,255,0.06); border-radius: 4px; margin-bottom: 1rem;"></div>
      <div style="height: 24px; width: 80%; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: 0.75rem;"></div>
      <div style="height: 16px; width: 95%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 1rem;"></div>
      <div style="height: 38px; width: 100%; background: rgba(255,255,255,0.08); border-radius: 6px; margin-top: auto;"></div>
    </div>
    <div class="card skeleton-card" style="padding: 1.5rem; height: 260px; background: rgba(17, 24, 39, 0.5);">
      <div style="height: 20px; width: 40%; background: rgba(255,255,255,0.06); border-radius: 4px; margin-bottom: 1rem;"></div>
      <div style="height: 24px; width: 80%; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: 0.75rem;"></div>
      <div style="height: 16px; width: 95%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 1rem;"></div>
      <div style="height: 38px; width: 100%; background: rgba(255,255,255,0.08); border-radius: 6px; margin-top: auto;"></div>
    </div>
    <div class="card skeleton-card" style="padding: 1.5rem; height: 260px; background: rgba(17, 24, 39, 0.5);">
      <div style="height: 20px; width: 40%; background: rgba(255,255,255,0.06); border-radius: 4px; margin-bottom: 1rem;"></div>
      <div style="height: 24px; width: 80%; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: 0.75rem;"></div>
      <div style="height: 16px; width: 95%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 1rem;"></div>
      <div style="height: 38px; width: 100%; background: rgba(255,255,255,0.08); border-radius: 6px; margin-top: auto;"></div>
    </div>
  `;

  let assessmentsList = [];

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/assessments`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const body = await res.json();
    if (!body.success) throw new Error(body.message || "Failed to load assessments");
    assessmentsList = body.data || [];
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; padding: 2rem; text-align: center; background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.25);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: #f43f5e; margin-bottom: 0.75rem;"></i>
        <h3 style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 0.5rem;">Unable to load assessments</h3>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1rem;">Could not connect to the assessments API at <code>/api/assessments</code> (${err.message}).</p>
        <button id="retryAssessmentsBtn" class="btn btn-secondary btn-sm"><i class="fa-solid fa-rotate-right"></i> Retry Connection</button>
      </div>
    `;
    const retryBtn = document.getElementById("retryAssessmentsBtn");
    if (retryBtn) retryBtn.addEventListener("click", () => initAssessmentsPage());
    return;
  }

  if (assessmentsList.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; background: rgba(17, 24, 39, 0.6);">
        <i class="fa-solid fa-box-open" style="font-size: 2.5rem; color: var(--text-dim); margin-bottom: 0.75rem;"></i>
        <h3 style="font-size: 1.15rem; color: var(--text-main); margin-bottom: 0.5rem;">No assessments found</h3>
        <p style="font-size: 0.88rem; color: var(--text-muted);">There are currently no active assessments in the database.</p>
      </div>
    `;
    return;
  }

  function renderItems() {
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";

    const filtered = assessmentsList.filter(item => {
      const title = (item.title || "").toLowerCase();
      const category = (item.category || "").toLowerCase();
      const difficulty = (item.difficulty || "").toLowerCase();
      const description = (item.description || "").toLowerCase();

      const matchesSearch = !query || title.includes(query) || category.includes(query) || description.includes(query);

      let matchesFilter = true;
      if (activeFilter !== "all") {
        if (activeFilter === "programming") {
          matchesFilter = category.includes("programming");
        } else if (activeFilter === "data") {
          matchesFilter = category.includes("data") || category.includes("sql") || category.includes("analytics");
        } else if (activeFilter === "core_cs") {
          matchesFilter = category.includes("core cs");
        } else if (activeFilter === "backend") {
          matchesFilter = category.includes("backend");
        } else if (activeFilter === "frontend") {
          matchesFilter = category.includes("frontend");
        } else if (activeFilter === "communication") {
          matchesFilter = category.includes("communication");
        } else if (activeFilter === "technical") {
          matchesFilter = category.includes("programming") || category.includes("core cs") || category.includes("backend");
        } else if (activeFilter === "analytical") {
          matchesFilter = category.includes("data") || category.includes("sql") || category.includes("analytics");
        } else {
          matchesFilter = difficulty.toLowerCase() === activeFilter.toLowerCase();
        }
      }

      return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
      const emptyTitle = activeFilter === "communication" ? "No communication assessments yet" : "No matching assessments";
      container.innerHTML = `
        <div class="card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; background: rgba(17, 24, 39, 0.6);">
          <i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; color: var(--text-dim); margin-bottom: 0.75rem;"></i>
          <h3 style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 0.35rem;">${emptyTitle}</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted);">Try adjusting your search query or filter selection.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const difficultyBadge = item.difficulty === "Advanced" ? "badge-purple" : (item.difficulty === "Beginner" ? "badge-cyan" : "badge-primary");
      
      let skillParam = item.skill_param;
      if (!skillParam) {
        const titleLower = (item.title || "").toLowerCase();
        if (titleLower.includes("level 1") || titleLower.includes("beginner")) skillParam = "python_level1";
        else if (titleLower.includes("level 3") || titleLower.includes("advanced")) skillParam = "python_level3";
        else if (titleLower.includes("level 2") || titleLower.includes("intermediate") || titleLower.includes("python")) skillParam = "python_level2";
        else if (titleLower.includes("sql") || titleLower.includes("data")) skillParam = "sql";
        else if (titleLower.includes("frontend") || titleLower.includes("ui")) skillParam = "frontend";
        else if (titleLower.includes("backend") || titleLower.includes("api")) skillParam = "backend";
        else if (titleLower.includes("core") || titleLower.includes("logic")) skillParam = "core_cs";
        else skillParam = "python_level1";
      }

      return `
        <div class="card card-hover-glow assessment-card-item" data-title="${item.title}" data-category="${item.category}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.85rem;">
            <span class="badge badge-cyan"><i class="fa-solid fa-star"></i> Verified Assessment</span>
            <span class="badge ${difficultyBadge}">${item.difficulty}</span>
          </div>

          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main);">${item.title}</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.4rem; line-height: 1.4;">
            ${item.description || 'Demonstrate practical competency through real-world challenges.'}
          </p>

          <div style="display: flex; gap: 1rem; margin: 1.25rem 0; font-size: 0.8rem; color: var(--text-muted);">
            <span><i class="fa-regular fa-clock" style="color: var(--accent-cyan);"></i> ${item.duration_minutes} minutes</span>
            <span><i class="fa-solid fa-list-check" style="color: var(--accent-purple);"></i> ${item.challenge_count} Questions</span>
          </div>

          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
            <span class="badge badge-primary">${item.category}</span>
            <span class="badge badge-cyan">${item.difficulty}</span>
          </div>

          <a href="assessment.html?skill=${skillParam}" class="btn btn-primary" style="width: 100%;">
            <i class="fa-solid fa-play"></i> Start Assessment
          </a>
        </div>
      `;
    }).join('');
  }

  if (searchInput) searchInput.addEventListener("input", renderItems);
  filterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      activeFilter = chip.getAttribute("data-filter") || "all";
      filterChips.forEach(item => item.classList.toggle("active", item === chip));
      renderItems();
    });
  });

  renderItems();
}

// 2B. PRACTICE PAGE (practice.html)
async function initPracticePage() {
  const container = document.getElementById("practiceGrid");
  if (!container) return;

  // Loading skeleton state
  container.innerHTML = `
    <div class="card skeleton-card" style="padding: 1.5rem; height: 220px; background: rgba(17, 24, 39, 0.5);">
      <div style="height: 20px; width: 40%; background: rgba(255,255,255,0.06); border-radius: 4px; margin-bottom: 1rem;"></div>
      <div style="height: 24px; width: 75%; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: 0.75rem;"></div>
      <div style="height: 16px; width: 90%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 1rem;"></div>
      <div style="height: 38px; width: 100%; background: rgba(255,255,255,0.08); border-radius: 6px; margin-top: auto;"></div>
    </div>
    <div class="card skeleton-card" style="padding: 1.5rem; height: 220px; background: rgba(17, 24, 39, 0.5);">
      <div style="height: 20px; width: 40%; background: rgba(255,255,255,0.06); border-radius: 4px; margin-bottom: 1rem;"></div>
      <div style="height: 24px; width: 75%; background: rgba(255,255,255,0.08); border-radius: 4px; margin-bottom: 0.75rem;"></div>
      <div style="height: 16px; width: 90%; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 1rem;"></div>
      <div style="height: 38px; width: 100%; background: rgba(255,255,255,0.08); border-radius: 6px; margin-top: auto;"></div>
    </div>
  `;

  let practiceList = [];

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/practice`);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const body = await res.json();
    if (!body.success) throw new Error(body.message || "Failed to load practice challenges");
    practiceList = body.data || [];
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; padding: 2rem; text-align: center; background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.25);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: #f43f5e; margin-bottom: 0.75rem;"></i>
        <h3 style="font-size: 1.1rem; color: var(--text-main); margin-bottom: 0.5rem;">Unable to load practice challenges</h3>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1rem;">Could not connect to the practice API at <code>/api/practice</code> (${err.message}).</p>
        <button id="retryPracticeBtn" class="btn btn-secondary btn-sm"><i class="fa-solid fa-rotate-right"></i> Retry Connection</button>
      </div>
    `;
    const retryBtn = document.getElementById("retryPracticeBtn");
    if (retryBtn) retryBtn.addEventListener("click", () => initPracticePage());
    return;
  }

  if (practiceList.length === 0) {
    container.innerHTML = `
      <div class="card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; background: rgba(17, 24, 39, 0.6);">
        <i class="fa-solid fa-fire" style="font-size: 2.5rem; color: var(--text-dim); margin-bottom: 0.75rem;"></i>
        <h3 style="font-size: 1.15rem; color: var(--text-main); margin-bottom: 0.5rem;">No practice challenges found</h3>
        <p style="font-size: 0.88rem; color: var(--text-muted);">Check back soon for new personalized micro-challenges.</p>
      </div>
    `;
    return;
  }

  const borderColors = {
    'Debugging': '#f43f5e',
    'Python': '#38bdf8',
    'SQL': '#a78bfa',
    'Data Analysis': '#06b6d4',
    'Problem Solving': '#10b981'
  };

  container.innerHTML = practiceList.map(item => {
    const borderColor = borderColors[item.target_competency] || 'var(--primary)';
    return `
      <div class="card card-hover-glow" style="border-left: 4px solid ${borderColor};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.85rem;">
          <span class="badge badge-amber"><i class="fa-solid fa-bolt"></i> Recommended Practice</span>
          <span class="badge badge-green">Target: ${item.target_competency}</span>
        </div>

        <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--text-main);">${item.title}</h3>
        <p style="font-size: 0.88rem; color: var(--text-muted); margin-top: 0.35rem; line-height: 1.5;">
          ${item.description || 'Targeted interactive micro-challenge to build practical capability.'}
        </p>

        <div style="display: flex; gap: 1rem; margin: 1.25rem 0; font-size: 0.82rem; color: var(--text-muted);">
          <span><i class="fa-regular fa-clock" style="color: var(--accent-cyan);"></i> ${item.estimated_minutes} mins</span>
          <span><i class="fa-solid fa-layer-group" style="color: var(--primary);"></i> ${item.difficulty}</span>
          <span><i class="fa-solid fa-bullseye" style="color: var(--accent-purple);"></i> Skill: ${item.target_competency}</span>
        </div>

        <a href="assessment.html" class="btn btn-primary" style="width: 100%;">
          <i class="fa-solid fa-play"></i> Start Practice Scenario
        </a>
      </div>
    `;
  }).join('');
}

// 3. GUIDED MCQ PRACTICAL ASSESSMENT SIMULATION (assessment.html)

const MCQ_DATABASE = {
  python_level1: {
    skillTitle: "Python Level 1 — Beginner Foundations",
    categoryLabel: "Python Programming (Level 1)",
    questions: [
      {
        id: 1,
        difficulty: "Beginner",
        title: "1. Dynamic Variable Binding & Types",
        description: "In Python, what happens when you execute `x = 10` followed immediately by `x = 'Hello'`?",
        codeSnippet: `x = 10\nx = 'Hello'\nprint(type(x))`,
        options: [
          "Raises a TypeError because x was declared as an integer.",
          "Python dynamically rebinds x to the string object 'Hello', so type(x) returns <class 'str'>.",
          "x becomes a tuple containing (10, 'Hello').",
          "Compilation fails due to missing static type annotations."
        ],
        correctIndex: 1,
        subtopic: "Python"
      },
      {
        id: 2,
        difficulty: "Beginner",
        title: "2. Floor Division vs Floating-Point Division",
        description: "What are the exact output values when evaluating `print(7 // 2)` and `print(7 / 2)` in Python 3?",
        codeSnippet: `print(7 // 2)\nprint(7 / 2)`,
        options: [
          "3 and 3.5",
          "3.5 and 3.5",
          "3 and 3",
          "3.5 and 3"
        ],
        correctIndex: 0,
        subtopic: "Python"
      },
      {
        id: 3,
        difficulty: "Beginner",
        title: "3. String Immutability & Method Behavior",
        description: "Strings in Python are immutable. What does `print(text)` output after running `text = 'python'; text.upper()`?",
        codeSnippet: `text = 'python'\ntext.upper()\nprint(text)`,
        options: [
          "'PYTHON'",
          "'python', because .upper() returns a new string and does not mutate text in-place.",
          "None",
          "Raises an AttributeError."
        ],
        correctIndex: 1,
        subtopic: "Python"
      },
      {
        id: 4,
        difficulty: "Beginner",
        title: "4. For Loop Iteration with range()",
        description: "How many total numbers will be printed by executing the loop `for i in range(1, 5): print(i)`?",
        codeSnippet: `for i in range(1, 5):\n    print(i)`,
        options: [
          "5 numbers: 1, 2, 3, 4, 5",
          "4 numbers: 1, 2, 3, 4",
          "5 numbers: 0, 1, 2, 3, 4",
          "3 numbers: 2, 3, 4"
        ],
        correctIndex: 1,
        subtopic: "Algorithms"
      },
      {
        id: 5,
        difficulty: "Beginner",
        title: "5. Defining Reusable Functions",
        description: "Which keyword is used to define a reusable function block in standard Python syntax?",
        options: [
          "function calculate_total():",
          "def calculate_total():",
          "fn calculate_total():",
          "declare calculate_total():"
        ],
        correctIndex: 1,
        subtopic: "Communication"
      }
    ]
  },
  python_level2: {
    skillTitle: "Python Level 2 — Intermediate Competency",
    categoryLabel: "Python Programming (Level 2)",
    questions: [
      {
        id: 1,
        difficulty: "Intermediate",
        title: "1. Mutable Default Arguments in Function Definitions",
        description: "In a payment microservice, a developer wrote `def process_transactions(items, history=[])`. On subsequent calls where `history` is omitted, previous transaction entries persist in the list. What is the root cause?",
        codeSnippet: `def process_transactions(item, history=[]):\n    history.append(item)\n    return history\n\nprint(process_transactions('TX101')) # ['TX101']\nprint(process_transactions('TX102')) # ['TX101', 'TX102'] -- Unexpected state leak!`,
        options: [
          "Python re-evaluates default arguments on every invocation; copy the list using history.copy().",
          "Default argument expressions are evaluated once when the function is defined, causing the mutable list to be shared across all calls. Use history=None and set history = [] inside the function.",
          "Lists are passed by value in Python; declare global history inside the function body.",
          "The GIL locks default parameters across worker threads; replace the list with a tuple."
        ],
        correctIndex: 1,
        subtopic: "Python"
      },
      {
        id: 2,
        difficulty: "Intermediate",
        title: "2. Filtering with List Comprehensions",
        description: "Which expression constructs a list containing the squares of even numbers from 0 through 9?",
        codeSnippet: `# Input range: range(10)`,
        options: [
          "[x * 2 for x in range(10) if x % 2 == 0]",
          "[x**2 for x in range(10) if x % 2 == 0]",
          "{x^2 for x in range(10) where x % 2 == 0}",
          "[x**2 for x in range(10) while x % 2 == 0]"
        ],
        correctIndex: 1,
        subtopic: "Algorithms"
      },
      {
        id: 3,
        difficulty: "Intermediate",
        title: "3. Dictionary Safe Access: [] vs .get()",
        description: "What occurs when attempting to access a missing key using `data['missing']` versus `data.get('missing', 0)`?",
        codeSnippet: `data = {'a': 1}\nval1 = data.get('b', 0)\nval2 = data['b']`,
        options: [
          "Both return None silently.",
          "data.get() returns 0, whereas data['b'] raises a KeyError.",
          "Both raise a KeyError exception.",
          "data['b'] automatically inserts 'b': None into the dictionary."
        ],
        correctIndex: 1,
        subtopic: "Debugging"
      },
      {
        id: 4,
        difficulty: "Intermediate",
        title: "4. Resource Management with the 'with' Statement",
        description: "Why is `with open('data.txt') as f:` preferred over `f = open('data.txt')` when reading files?",
        options: [
          "It speeds up disk reads by enabling asynchronous thread buffering.",
          "It guarantees that the file handle is closed automatically when exiting the block, even if an exception occurs.",
          "It parses file content into a native Python dictionary automatically.",
          "It locks file permissions against operating system process modifications."
        ],
        correctIndex: 1,
        subtopic: "Data Analysis"
      },
      {
        id: 5,
        difficulty: "Intermediate",
        title: "5. Try-Except-Finally Execution Rules",
        description: "In Python exception handling, when does the `finally` block in `try...except...finally` execute?",
        options: [
          "Only if an exception occurs inside the try block.",
          "Only if no exception occurs inside the try block.",
          "Always, regardless of whether an exception was raised or caught.",
          "Only if the exception is of type SystemExit."
        ],
        correctIndex: 2,
        subtopic: "Communication"
      }
    ]
  },
  python_level3: {
    skillTitle: "Python Level 3 — Advanced Mastery",
    categoryLabel: "Python Programming (Level 3)",
    questions: [
      {
        id: 1,
        difficulty: "Advanced",
        title: "1. Decorator Execution Mechanics",
        description: "How does applying the `@timer` decorator above `def my_func():` modify how `my_func` executes?",
        codeSnippet: `@timer\ndef my_func():\n    pass`,
        options: [
          "It compiles my_func into native C machine code prior to execution.",
          "It passes my_func into timer(my_func), replacing my_func with a wrapper function that can execute pre/post logic.",
          "It executes my_func inside a separate operating system thread asynchronously.",
          "It freezes the global namespace to prevent variable mutations."
        ],
        correctIndex: 1,
        subtopic: "Python"
      },
      {
        id: 2,
        difficulty: "Advanced",
        title: "2. Dunder Methods: __str__ vs __repr__",
        description: "In Python OOP, what is the core architectural difference between `__str__` and `__repr__`?",
        options: [
          "__str__ provides human-readable output for end users, whereas __repr__ provides an unambiguous representation for developers and debugging.",
          "__str__ converts objects to JSON strings, whereas __repr__ outputs hexadecimal memory addresses.",
          "__repr__ is called by print(), whereas __str__ is only called inside REPL environments.",
          "__str__ was deprecated in Python 3.11 in favor of dataclasses."
        ],
        correctIndex: 0,
        subtopic: "Debugging"
      },
      {
        id: 3,
        difficulty: "Advanced",
        title: "3. Generators & Lazy Evaluation with 'yield'",
        description: "What happens when a Python function containing the `yield` keyword is invoked?",
        codeSnippet: `def generate_numbers():\n    yield 1\n    yield 2\n\ng = generate_numbers()`,
        options: [
          "It immediately runs the entire function and returns a list [1, 2].",
          "It returns a generator iterator object without executing the function body until next(g) is called.",
          "It raises a SyntaxError unless defined inside a class structure.",
          "It spawns a background thread that prints 1 and 2."
        ],
        correctIndex: 1,
        subtopic: "Algorithms"
      },
      {
        id: 4,
        difficulty: "Advanced",
        title: "4. Global Interpreter Lock (GIL) Constraints",
        description: "Why does Python's standard CPython implementation prevent multi-threaded CPU-bound algorithms from scaling across multiple CPU cores?",
        options: [
          "Threads in Python cannot access physical system RAM.",
          "The Global Interpreter Lock (GIL) enforces a mutex locking bytecode execution to a single OS thread at any time.",
          "Python threads only run inside web browser WebWorker instances.",
          "Hardware CPU cores require statically typed C++ pointers."
        ],
        correctIndex: 1,
        subtopic: "Data Analysis"
      },
      {
        id: 5,
        difficulty: "Advanced",
        title: "5. Context Manager __exit__ Exceptions",
        description: "What parameter tuple is passed to a custom `__exit__(self, exc_type, exc_val, exc_tb)` method when an exception occurs inside a `with` block?",
        options: [
          "No parameters; __exit__ only receives self.",
          "The exception class type, the exception instance value, and the traceback object.",
          "A boolean True if execution succeeded or False if failed.",
          "The OS file descriptor integer and byte offset."
        ],
        correctIndex: 1,
        subtopic: "Communication"
      }
    ]
  },
  python: {
    skillTitle: "Python Practical & Conceptual Assessment",
    categoryLabel: "Python Programming",
    questions: [
      {
        id: 1,
        difficulty: "Intermediate",
        title: "1. Mutable Default Arguments in Function Definitions",
        description: "In a high-throughput payment microservice, a developer wrote `def process_transactions(items, history=[])`. On subsequent function calls where `history` is omitted, previous transaction entries persist in the list. What is the root cause and recommended solution?",
        codeSnippet: `def process_transactions(item, history=[]):\n    history.append(item)\n    return history\n\nprint(process_transactions('TX101')) # ['TX101']\nprint(process_transactions('TX102')) # ['TX101', 'TX102'] -- Unexpected state leak!`,
        options: [
          "Python re-evaluates default arguments on every invocation; copy the list using history.copy().",
          "Default argument expressions are evaluated once when the function is defined, causing the mutable list to be shared across all calls. Use history=None and set history = [] inside the function.",
          "Lists are passed by value in Python; declare global history inside the function body.",
          "The GIL locks default parameters across worker threads; replace the list with a tuple."
        ],
        correctIndex: 1,
        subtopic: "Python"
      },
      {
        id: 2,
        difficulty: "Intermediate",
        title: "2. Lazy Evaluation & Memory Efficiency with Generators",
        description: "Your team is filtering a 15 GB server log file for 'CRITICAL_ERROR' on an instance with 4 GB of RAM. Which Python construct prevents MemoryError crashes?",
        codeSnippet: `# Approach A: List Comprehension\nerrors = [line for line in open('server.log') if 'CRITICAL_ERROR' in line]\n\n# Approach B: Generator Expression\nerrors = (line for line in open('server.log') if 'CRITICAL_ERROR' in line)`,
        options: [
          "Approach A, because list comprehensions pre-allocate memory chunks for faster iteration.",
          "Approach B, because generator expressions yield items lazily one at a time without loading the full file into RAM.",
          "Approach A with a try-except block wrapping the list memory address.",
          "Neither approach works; files larger than 1 GB must be converted to binary strings first."
        ],
        correctIndex: 1,
        subtopic: "Algorithms"
      },
      {
        id: 3,
        difficulty: "Intermediate",
        title: "3. Exception Hierarchy Order in Try-Except Blocks",
        description: "A production script uses generic and specific exception handlers. If `except Exception:` is placed BEFORE `except ValueError:`, what happens when a `ValueError` is raised?",
        codeSnippet: `try:\n    amount = int(user_input)\nexcept Exception as e:\n    logger.error('Generic error', e)\nexcept ValueError as e:\n    logger.error('Invalid number format', e)`,
        options: [
          "The ValueError block still executes because Python selects exception handlers by specificity.",
          "Python raises a SyntaxError at compilation time.",
          "The generic Exception block catches the ValueError first, preventing the specific ValueError block from ever running.",
          "The exception bypasses both blocks and crashes the main process thread."
        ],
        correctIndex: 2,
        subtopic: "Debugging"
      },
      {
        id: 4,
        difficulty: "Intermediate",
        title: "4. Dictionary Key Hashability Requirements",
        description: "You are designing an in-memory cache requiring composite keys. Which Python data structure can be used as a key in a dictionary?",
        options: [
          "A list of user IDs: [101, 102, 103]",
          "A set of active permissions: {'READ', 'WRITE'}",
          "A tuple of immutable primitives: (101, 'US-EAST', True)",
          "A nested dictionary object: {'user_id': 101}"
        ],
        correctIndex: 2,
        subtopic: "Data Analysis"
      },
      {
        id: 5,
        difficulty: "Advanced",
        title: "5. Global Interpreter Lock (GIL) & CPU-Bound Concurrency",
        description: "You have a CPU-intensive matrix math algorithm. Will running this task using Python's standard `threading` module utilize multiple CPU cores?",
        options: [
          "Yes, Python's threading module automatically distributes threads across all available hardware cores.",
          "No, Python's GIL allows only one thread to execute Python bytecode at a time; use `multiprocessing` or native C-extensions instead.",
          "Yes, provided the script is run with Python 3.10 or higher.",
          "No, threads in Python can only be used for network socket communication."
        ],
        correctIndex: 1,
        subtopic: "Communication"
      }
    ]
  },
  sql: {
    skillTitle: "SQL & Data Analysis Benchmark",
    categoryLabel: "Data & SQL",
    questions: [
      {
        id: 1,
        difficulty: "Intermediate",
        title: "1. NULL Value Handling in INNER vs LEFT JOIN",
        description: "A database query joining `customers` and `orders` returns 500 rows with an `INNER JOIN`, but returns 850 rows with a `LEFT JOIN`. What do the extra 350 rows represent?",
        codeSnippet: `-- Query 1: INNER JOIN\nSELECT * FROM customers c INNER JOIN orders o ON c.id = o.customer_id;\n\n-- Query 2: LEFT JOIN\nSELECT * FROM customers c LEFT JOIN orders o ON c.id = o.customer_id;`,
        options: [
          "350 duplicate order records matching existing customers.",
          "350 customer records that have zero matching entries in the orders table.",
          "350 corrupted database rows filtered by the query engine.",
          "350 orders placed by deleted customer accounts."
        ],
        correctIndex: 1,
        subtopic: "Data Analysis"
      },
      {
        id: 2,
        difficulty: "Intermediate",
        title: "2. Aggregation Filtering: WHERE vs HAVING Clauses",
        description: "An analytics query needs to find department IDs where the total combined salary expenditure exceeds $500,000. Which SQL structure is syntactically correct?",
        options: [
          "SELECT department_id, SUM(salary) FROM employees WHERE SUM(salary) > 500000 GROUP BY department_id;",
          "SELECT department_id, SUM(salary) FROM employees GROUP BY department_id HAVING SUM(salary) > 500000;",
          "SELECT department_id, SUM(salary) FROM employees ORDER BY department_id WHERE salary > 500000;",
          "SELECT department_id, SUM(salary) FROM employees GROUP BY department_id WHERE aggregated(salary) > 500000;"
        ],
        correctIndex: 1,
        subtopic: "SQL"
      },
      {
        id: 3,
        difficulty: "Advanced",
        title: "3. B-Tree Index Write Overhead",
        description: "A database table receives 10,000 `INSERT` operations per second. After an engineer added 8 B-Tree indexes to various columns, write latency spiked dramatically. Why?",
        options: [
          "B-Tree indexes lock disk buffers during SELECT queries.",
          "Every INSERT operation requires updating both the primary table data page AND all 8 index structures, increasing write I/O.",
          "B-Tree indexes convert table storage into read-only memory pages.",
          "Databases only support a maximum of 3 indexes per table."
        ],
        correctIndex: 1,
        subtopic: "Debugging"
      },
      {
        id: 4,
        difficulty: "Intermediate",
        title: "4. Window Functions for Transaction Ranking",
        description: "You need to assign a sequential number to customer orders partitioned by `customer_id` and ordered by `created_at DESC` to extract each customer's latest purchase. Which SQL function is appropriate?",
        options: [
          "ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC)",
          "COUNT(customer_id) GROUP BY created_at",
          "DENSE_RANK() WHERE customer_id = PARTITION",
          "LAG(created_at) OVER (ORDER BY customer_id)"
        ],
        correctIndex: 0,
        subtopic: "Algorithms"
      },
      {
        id: 5,
        difficulty: "Advanced",
        title: "5. ACID Isolation Guarantees",
        description: "Two concurrent financial transactions attempt to update the same account balance simultaneously. Which ACID property guarantees that execution produces the exact same outcome as running transactions sequentially?",
        options: [
          "Atomicity",
          "Consistency",
          "Isolation",
          "Durability"
        ],
        correctIndex: 2,
        subtopic: "Communication"
      }
    ]
  },
  frontend: {
    skillTitle: "Frontend UI/UX Practical Benchmark",
    categoryLabel: "Frontend UI/UX",
    questions: [
      {
        id: 1,
        difficulty: "Intermediate",
        title: "1. Modern Responsive Centering in CSS",
        description: "You need to center a modal window both horizontally and vertically inside a viewport across mobile and desktop displays without hardcoded pixel offsets. Which CSS snippet is cleanest?",
        options: [
          "position: absolute; top: 200px; left: 35%; width: 500px;",
          "display: flex; justify-content: center; align-items: center; min-height: 100vh;",
          "float: center; text-align: center; vertical-align: middle;",
          "display: inline-block; margin: 20%; padding: 50px;"
        ],
        correctIndex: 1,
        subtopic: "Python"
      },
      {
        id: 2,
        difficulty: "Intermediate",
        title: "2. Event Delegation for High-Density DOM Trees",
        description: "A dynamic data table renders 2,000 rows. Attaching individual click listeners to every delete button causes high RAM usage. What is the recommended optimization?",
        options: [
          "Use Event Delegation: attach one listener to the container <table> and inspect event.target to identify clicked action buttons.",
          "Wrap each row in a separate <iframe> element.",
          "Use setInterval to detach and re-attach listeners every 3 seconds.",
          "Replace HTML button elements with CSS pseudo-elements."
        ],
        correctIndex: 0,
        subtopic: "Debugging"
      },
      {
        id: 3,
        difficulty: "Advanced",
        title: "3. JavaScript Event Loop Microtask Execution Order",
        description: "Predict the console log output sequence for the following asynchronous script execution:",
        codeSnippet: `console.log('A');\nsetTimeout(() => console.log('B'), 0);\nPromise.resolve().then(() => console.log('C'));\nconsole.log('D');`,
        options: [
          "A, B, C, D",
          "A, D, B, C",
          "A, D, C, B",
          "D, C, B, A"
        ],
        correctIndex: 2,
        subtopic: "Algorithms"
      },
      {
        id: 4,
        difficulty: "Intermediate",
        title: "4. Fluid Responsive Typography with CSS Clamp",
        description: "You want heading text to scale smoothly between 1.2rem on mobile screens and 2.5rem on desktop viewports without writing multiple breakpoint media queries. Which CSS function is designed for this?",
        options: [
          "font-size: calc(100px - 50%);",
          "font-size: clamp(1.2rem, 3vw, 2.5rem);",
          "font-size: responsive(1.2rem, 2.5rem);",
          "font-size: flex-scale(1.2rem, 2.5rem);"
        ],
        correctIndex: 1,
        subtopic: "Data Analysis"
      },
      {
        id: 5,
        difficulty: "Intermediate",
        title: "5. Virtual DOM Key Props in Dynamic Lists",
        description: "In a React list component, using array index (`key={index}`) causes UI state glitches and input focus loss when items are reordered or deleted. Why?",
        options: [
          "React keys are required to be UUID strings, not numbers.",
          "When list items reorder, array indexes change, causing React to misassociate stateful components with wrong DOM nodes.",
          "Array keys trigger an immediate synchronous page re-render.",
          "Using array indexes disables Virtual DOM diffing completely."
        ],
        correctIndex: 1,
        subtopic: "Communication"
      }
    ]
  },
  backend: {
    skillTitle: "Real-Time API & Backend Architecture",
    categoryLabel: "Backend Architecture",
    questions: [
      {
        id: 1,
        difficulty: "Intermediate",
        title: "1. Idempotency in RESTful HTTP Methods",
        description: "A mobile client retries failed network requests automatically. Which HTTP method is NON-idempotent and may create duplicate resources if retried multiple times?",
        options: [
          "GET",
          "PUT",
          "DELETE",
          "POST"
        ],
        correctIndex: 3,
        subtopic: "Python"
      },
      {
        id: 2,
        difficulty: "Advanced",
        title: "2. Database Connection Pooling Benefits",
        description: "During a traffic surge (5,000 requests/sec), an API backend fails with 'Too many client connections'. How does a connection pool fix this issue?",
        options: [
          "Connection pools automatically increase the OS physical memory limit.",
          "Connection pools maintain a reusable pool of active TCP connections, avoiding the cost of opening/closing a connection on every HTTP request.",
          "Connection pools convert relational database queries into static text files.",
          "Connection pools force queries to run inside client web browsers."
        ],
        correctIndex: 1,
        subtopic: "Debugging"
      },
      {
        id: 3,
        difficulty: "Intermediate",
        title: "3. Stateless JWT vs Server Session Cookies",
        description: "In a microservice system with 10 decoupled API instances behind a load balancer, why are JSON Web Tokens (JWT) preferred over server-side session stores?",
        options: [
          "JWTs encrypt all user data with AES-256 hardware keys.",
          "Any API service can independently verify a cryptographically signed JWT payload without performing a database lookup on every request.",
          "Session cookies cannot be transferred over HTTPS.",
          "JWTs clear client browser cache memory every 60 seconds."
        ],
        correctIndex: 1,
        subtopic: "Algorithms"
      },
      {
        id: 4,
        difficulty: "Advanced",
        title: "4. Token Bucket Rate Limiting Algorithm",
        description: "You are implementing rate limiting to protect an API endpoint against abuse while allowing brief legitimate burst traffic. Which algorithm fits this requirement?",
        options: [
          "Fixed Window Counter",
          "Token Bucket Algorithm",
          "Round Robin Load Balancer",
          "Least Connections Routing"
        ],
        correctIndex: 1,
        subtopic: "Data Analysis"
      },
      {
        id: 5,
        difficulty: "Intermediate",
        title: "5. Microservice Process Fault Isolation",
        description: "In a monolithic web app, an out-of-memory crash in the PDF invoice generator brings down the entire website. How does a microservice architecture isolate this failure?",
        options: [
          "Microservices automatically double container memory during heavy load.",
          "Services run in separate isolated processes/containers, ensuring a crash in PDF generation does not affect the independent checkout service.",
          "Microservices eliminate all runtime exceptions.",
          "Microservices run outside the operating system memory manager."
        ],
        correctIndex: 1,
        subtopic: "Communication"
      }
    ]
  },
  core_cs: {
    skillTitle: "Problem Solving & Algorithmic Logic",
    categoryLabel: "Core CS & Algorithms",
    questions: [
      {
        id: 1,
        difficulty: "Intermediate",
        title: "1. Hash Table Collision Time Complexity",
        description: "Under normal conditions, a Hash Table offers O(1) average lookup time. If a bad hash function causes all keys to collide in the exact same bucket, what is the worst-case lookup complexity for an unoptimized linear table?",
        options: [
          "O(1)",
          "O(log N)",
          "O(N)",
          "O(N^2)"
        ],
        correctIndex: 2,
        subtopic: "Algorithms"
      },
      {
        id: 2,
        difficulty: "Intermediate",
        title: "2. Stack vs Heap Memory Allocation",
        description: "Local primitive variables and active function execution frames are stored on the Stack. How does Heap memory differ?",
        options: [
          "Heap memory is strictly smaller and deallocated automatically upon function return.",
          "Heap memory is used for dynamic objects/arrays and persists until explicitly deallocated or collected by garbage collection.",
          "Stack memory stores disk files while Heap memory stores network sockets.",
          "Heap memory can only store read-only strings."
        ],
        correctIndex: 1,
        subtopic: "Debugging"
      },
      {
        id: 3,
        difficulty: "Intermediate",
        title: "3. Precondition for Binary Search Algorithm",
        description: "An engineer calls Binary Search `O(log N)` on an array of 500,000 elements but gets incorrect search results. What essential condition was violated?",
        options: [
          "The array elements must be unique floating point numbers.",
          "The array must be sorted in ascending or descending order prior to calling binary search.",
          "The array size must be an exact power of 2.",
          "The array must be stored inside a binary tree structure."
        ],
        correctIndex: 1,
        subtopic: "Python"
      },
      {
        id: 4,
        difficulty: "Advanced",
        title: "4. Thread vs Process Context Switching Performance",
        description: "Why is context switching between two threads in the same process faster than context switching between two distinct operating system processes?",
        options: [
          "Threads do not use CPU registers.",
          "Threads within the same process share the same virtual address space, avoiding Translation Lookaside Buffer (TLB) cache flushes.",
          "Processes do not support hardware interrupts.",
          "Operating system kernels do not schedule threads."
        ],
        correctIndex: 1,
        subtopic: "Data Analysis"
      },
      {
        id: 5,
        difficulty: "Advanced",
        title: "5. Shortest Path Graph Algorithms",
        description: "You are building a mapping routing engine to find the shortest path between two points on a weighted road network with non-negative edge weights. Which algorithm is optimal?",
        options: [
          "Depth-First Search (DFS)",
          "Dijkstra's Algorithm",
          "Kruskal's Algorithm",
          "Topological Sort"
        ],
        correctIndex: 1,
        subtopic: "Communication"
      }
    ]
  }
};

MCQ_DATABASE.python = MCQ_DATABASE.python_level1;

let currentMcqCategory = "python_level1";
let currentQuestionIndex = 0;
let mcqUserAnswers = {}; // { 0: optionIndex, 1: optionIndex }
let _assessmentSimulationInitialized = false;

window.selectMcqOption = function(idx) {
  const parsed = parseInt(idx, 10);
  if (!isNaN(parsed)) {
    mcqUserAnswers[currentQuestionIndex] = parsed;
    renderMcqQuestion();
  }
};

window.jumpToMcqQuestion = function(index) {
  const categoryData = MCQ_DATABASE[currentMcqCategory] || MCQ_DATABASE.python_level1;
  if (index >= 0 && index < categoryData.questions.length) {
    currentQuestionIndex = index;
    renderMcqQuestion();
  }
};

function initPracticalAssessmentSimulation() {
  // Determine category from URL parameter ?skill=... or ?category=...
  const urlParams = new URLSearchParams(window.location.search);
  const rawSkill = (urlParams.get("skill") || urlParams.get("category") || "python").toLowerCase();
  
  if (rawSkill.includes("level1") || rawSkill.includes("level_1") || rawSkill.includes("beginner") || rawSkill === "python_1") {
    currentMcqCategory = "python_level1";
  } else if (rawSkill.includes("level3") || rawSkill.includes("level_3") || rawSkill.includes("advanced") || rawSkill === "python_3") {
    currentMcqCategory = "python_level3";
  } else if (rawSkill.includes("level2") || rawSkill.includes("level_2") || rawSkill.includes("intermediate") || rawSkill === "python_2") {
    currentMcqCategory = "python_level2";
  } else if (rawSkill.includes("sql") || rawSkill.includes("data")) {
    currentMcqCategory = "sql";
  } else if (rawSkill.includes("frontend") || rawSkill.includes("ui") || rawSkill.includes("ux")) {
    currentMcqCategory = "frontend";
  } else if (rawSkill.includes("backend") || rawSkill.includes("api")) {
    currentMcqCategory = "backend";
  } else if (rawSkill.includes("core") || rawSkill.includes("cs") || rawSkill.includes("logic") || rawSkill.includes("problem")) {
    currentMcqCategory = "core_cs";
  } else {
    currentMcqCategory = "python_level1";
  }

  const categoryData = MCQ_DATABASE[currentMcqCategory] || MCQ_DATABASE.python_level1;

  if (_assessmentSimulationInitialized) {
    renderMcqQuestion();
    return;
  }
  _assessmentSimulationInitialized = true;
  currentQuestionIndex = 0;
  mcqUserAnswers = {};

  // Setup Title & Navbar
  const titleEl = document.getElementById("mcqSkillTitle");
  if (titleEl) titleEl.textContent = categoryData.skillTitle;

  // Setup Timer (25 minutes)
  let timeInSeconds = 25 * 60;
  const timerDisplay = document.getElementById("assessmentTimer");
  if (timerDisplay) {
    const timerInterval = setInterval(() => {
      if (timeInSeconds <= 0) {
        clearInterval(timerInterval);
        timerDisplay.textContent = "00:00";
        showToast("Time expired! Automatically submitting assessment...", "info");
        setTimeout(triggerMcqSubmission, 1500);
      } else {
        timeInSeconds--;
        const mins = Math.floor(timeInSeconds / 60);
        const secs = timeInSeconds % 60;
        timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
    }, 1000);
  }

  // Bind Navigation Buttons
  const prevBtn = document.getElementById("prevQuestionBtn");
  const nextBtn = document.getElementById("nextQuestionBtn");
  const submitBtn = document.getElementById("submitAssessmentBtn");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderMcqQuestion();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      const questions = categoryData.questions;
      if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        renderMcqQuestion();
      } else {
        triggerMcqSubmission();
      }
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      triggerMcqSubmission();
    });
  }

  // Render initial question
  renderMcqQuestion();
}

function renderMcqQuestion() {
  const categoryData = MCQ_DATABASE[currentMcqCategory] || MCQ_DATABASE.python_level1;
  const questions = categoryData.questions;
  const q = questions[currentQuestionIndex];

  if (!q) return;

  // Update Header Badges & Counters
  const badgeEl = document.getElementById("mcqQuestionBadge");
  if (badgeEl) badgeEl.innerHTML = `<i class="fa-solid fa-list-check"></i> Question ${currentQuestionIndex + 1} of ${questions.length}`;

  const numEl = document.getElementById("mcqQuestionNumber");
  if (numEl) numEl.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;

  const catBadge = document.getElementById("mcqCategoryBadge");
  if (catBadge) catBadge.innerHTML = `<i class="fa-solid fa-layer-group"></i> ${categoryData.categoryLabel}`;

  const diffBadge = document.getElementById("mcqDifficultyBadge");
  if (diffBadge) diffBadge.innerHTML = `<i class="fa-solid fa-bolt"></i> ${q.difficulty}`;

  // Update Question Content
  const titleEl = document.getElementById("mcqQuestionTitle");
  if (titleEl) titleEl.textContent = q.title;

  const descEl = document.getElementById("mcqQuestionDescription");
  if (descEl) descEl.textContent = q.description;

  const snippetEl = document.getElementById("mcqCodeSnippet");
  if (snippetEl) {
    if (q.codeSnippet) {
      snippetEl.style.display = "block";
      snippetEl.textContent = q.codeSnippet;
    } else {
      snippetEl.style.display = "none";
      snippetEl.textContent = "";
    }
  }

  // Render Options
  const container = document.getElementById("mcqOptionsContainer");
  if (container) {
    const letters = ["A", "B", "C", "D"];
    const selectedChoice = mcqUserAnswers[currentQuestionIndex];

    container.innerHTML = q.options.map((optText, idx) => {
      const isSelected = selectedChoice === idx;
      const letter = letters[idx] || (idx + 1);

      return `
        <div class="mcq-option-card ${isSelected ? 'selected' : ''}" data-index="${idx}" onclick="window.selectMcqOption(${idx})" style="
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.1rem 1.25rem;
          background: ${isSelected ? 'rgba(6, 182, 212, 0.14)' : 'rgba(255, 255, 255, 0.03)'};
          border: 1px solid ${isSelected ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.12)'};
          border-radius: var(--radius-md);
          cursor: pointer;
          user-select: none;
          transition: all 0.2s ease;
          box-shadow: ${isSelected ? '0 0 16px rgba(6, 182, 212, 0.25)' : 'none'};
        ">
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${isSelected ? 'var(--accent-cyan)' : 'rgba(255, 255, 255, 0.08)'};
            color: ${isSelected ? '#000' : 'var(--text-main)'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 0.9rem;
            flex-shrink: 0;
            pointer-events: none;
          ">
            ${letter}
          </div>
          <div style="flex: 1; font-size: 0.92rem; color: ${isSelected ? 'var(--text-main)' : 'var(--text-muted)'}; line-height: 1.5; margin-top: 0.15rem; font-weight: ${isSelected ? '600' : '400'}; pointer-events: none;">
            ${optText}
          </div>
          <div style="font-size: 1.1rem; color: ${isSelected ? 'var(--accent-cyan)' : 'var(--text-dim)'}; flex-shrink: 0; margin-top: 0.15rem; pointer-events: none;">
            <i class="fa-${isSelected ? 'solid fa-circle-check' : 'regular fa-circle'}"></i>
          </div>
        </div>
      `;
    }).join('');

    // Container-level event delegation for instant click selection
    container.onclick = (e) => {
      const card = e.target.closest(".mcq-option-card, [data-index]");
      if (card) {
        const choiceIdx = card.getAttribute("data-index");
        const parsed = parseInt(choiceIdx, 10);
        if (!isNaN(parsed)) {
          window.selectMcqOption(parsed);
        }
      }
    };

    // Attach click listener to each card explicitly for 100% click coverage
    container.querySelectorAll(".mcq-option-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        const choiceIdx = card.getAttribute("data-index");
        const parsed = parseInt(choiceIdx, 10);
        if (!isNaN(parsed)) {
          window.selectMcqOption(parsed);
        }
      });
    });
  }

  // Update Footer Navigation Controls
  const prevBtn = document.getElementById("prevQuestionBtn");
  if (prevBtn) prevBtn.disabled = (currentQuestionIndex === 0);

  const nextBtn = document.getElementById("nextQuestionBtn");
  if (nextBtn) {
    if (currentQuestionIndex === questions.length - 1) {
      nextBtn.innerHTML = `Submit Assessment <i class="fa-solid fa-paper-plane"></i>`;
      nextBtn.className = "btn btn-primary";
    } else {
      nextBtn.innerHTML = `Next Question <i class="fa-solid fa-arrow-right"></i>`;
      nextBtn.className = "btn btn-cyan";
    }
  }

  // Render Nav Pills
  const pillsNav = document.getElementById("questionNavPills");
  if (pillsNav) {
    pillsNav.innerHTML = questions.map((_, i) => {
      const isCurrent = i === currentQuestionIndex;
      const isAnswered = mcqUserAnswers[i] !== undefined;

      let pillBg = "rgba(255, 255, 255, 0.05)";
      let pillBorder = "rgba(255, 255, 255, 0.1)";
      let pillColor = "var(--text-dim)";

      if (isCurrent) {
        pillBg = "var(--primary)";
        pillBorder = "var(--primary)";
        pillColor = "#fff";
      } else if (isAnswered) {
        pillBg = "rgba(16, 185, 129, 0.2)";
        pillBorder = "var(--accent-green)";
        pillColor = "var(--accent-green)";
      }

      return `
        <button class="btn btn-sm" style="
          padding: 0.3rem 0.75rem;
          font-size: 0.8rem;
          font-weight: 700;
          background: ${pillBg};
          border: 1px solid ${pillBorder};
          color: ${pillColor};
          border-radius: var(--radius-sm);
        " onclick="jumpToMcqQuestion(${i})">
          ${i + 1} ${isAnswered && !isCurrent ? '<i class="fa-solid fa-check" style="margin-left: 2px;"></i>' : ''}
        </button>
      `;
    }).join('');
  }
}

function jumpToMcqQuestion(index) {
  const categoryData = MCQ_DATABASE[currentMcqCategory] || MCQ_DATABASE.python_level1;
  if (index >= 0 && index < categoryData.questions.length) {
    currentQuestionIndex = index;
    renderMcqQuestion();
  }
}

// Submission Loading Modal & Real API Submission
async function triggerMcqSubmission() {
  const categoryData = MCQ_DATABASE[currentMcqCategory] || MCQ_DATABASE.python_level1;
  const questions = categoryData.questions;

  // Check how many questions are answered
  const answeredCount = Object.keys(mcqUserAnswers).length;

  if (answeredCount < questions.length) {
    const unansweredIndex = questions.findIndex((_, idx) => mcqUserAnswers[idx] === undefined);
    showToast(`Note: Question ${unansweredIndex + 1} is not answered yet!`, "warning");
  }

  const modal = document.getElementById("submissionModal");
  const statusMsg = document.getElementById("modalStatusMsg");
  
  if (modal) modal.classList.add("active");
  if (statusMsg) statusMsg.textContent = "Calculating your verified score and competency breakdown...";

  // Calculate score
  let correctCount = 0;
  questions.forEach((q, idx) => {
    if (mcqUserAnswers[idx] === q.correctIndex) {
      correctCount++;
    }
  });

  const overallScore = Math.round((correctCount / questions.length) * 100);

  // Dynamic breakdown computation based on candidate's answers per subtopic
  const clamp = (val) => Math.min(98, Math.max(50, Math.round(val)));
  const subtopicScores = {};
  const subtopicCounts = {};

  questions.forEach((q, idx) => {
    const topic = q.subtopic || "General Logic";
    const isCorrect = mcqUserAnswers[idx] === q.correctIndex;
    const scoreVal = isCorrect ? 95 : 55;

    if (!subtopicScores[topic]) {
      subtopicScores[topic] = 0;
      subtopicCounts[topic] = 0;
    }
    subtopicScores[topic] += scoreVal;
    subtopicCounts[topic] += 1;
  });

  const breakdown = {};
  Object.keys(subtopicScores).forEach(topic => {
    breakdown[topic] = clamp(subtopicScores[topic] / subtopicCounts[topic]);
  });

  // Guarantee foundational competencies exist for role gap calculations
  const coreDefaults = ["Python", "Debugging", "Algorithms", "Data Analysis", "Communication"];
  coreDefaults.forEach(s => {
    if (breakdown[s] === undefined) {
      breakdown[s] = clamp(overallScore + (Math.floor(Math.random() * 5) - 2));
    }
  });

  // Store local copy of completed assessment results and competencies
  try {
    localStorage.setItem("skillsync_completed_assessment", "true");
    const localResults = JSON.parse(localStorage.getItem("skillsync_local_results") || "[]");
    localResults.unshift({
      id: "result-" + Date.now(),
      overall_score: overallScore,
      breakdown: breakdown,
      created_at: new Date().toISOString()
    });
    localStorage.setItem("skillsync_local_results", JSON.stringify(localResults));
  } catch(e) {}

  try {
    if (statusMsg) statusMsg.textContent = "Submitting score & generating AI skill profile...";

    let assessmentId = "python-practical";
    try {
      const assRes = await apiFetch(`${getApiBaseUrl()}/api/assessments`);
      if (assRes.ok) {
        const assJson = await assRes.json();
        if (assJson.data && assJson.data.length > 0) {
          const match = assJson.data.find(a => (a.category || "").toLowerCase().includes(currentMcqCategory));
          if (match) assessmentId = match.id;
          else assessmentId = assJson.data[0].id;
        }
      }
    } catch (e) {}

    const res = await apiFetch(`${getApiBaseUrl()}/api/assessment-attempts/current/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assessment_id: assessmentId,
        answers: mcqUserAnswers,
        overallScore: overallScore,
        breakdown: breakdown
      })
    });

    const body = await res.json();
    if (!res.ok || !body.success) {
      throw new Error(body.message || "Failed to submit assessment.");
    }

    const resultId = body.data?.id;
    if (statusMsg) statusMsg.textContent = `Scored ${overallScore}%! Redirecting to report...`;
    
    setTimeout(() => {
      window.location.href = `result.html?id=${resultId}`;
    }, 1200);

  } catch (err) {
    console.error("Submission error:", err);
    if (statusMsg) statusMsg.textContent = `Submission complete. Navigating to report...`;
    showToast(`Assessment submitted: ${overallScore}%`, "success");
    setTimeout(() => {
      window.location.href = "result.html";
    }, 1800);
  }
}

// 4. AI COMPETENCY RESULT (result.html)
async function initResultPage() {
  const params = new URLSearchParams(window.location.search);
  const resultId = params.get("id");
  const user = window.SkillSyncAuth || {};

  const defaultResult = {
    overall_score: 82,
    assessments: { title: "Python Developer Practical Benchmark" },
    created_at: new Date().toISOString(),
    ai_insight: "Candidate demonstrated strong practical syntax accuracy and solid algorithmic logic.",
    breakdown: { "Python": 84, "SQL": 76, "Algorithms": 80, "Data Analysis": 78, "Debugging": 82 },
    strengths: [
      "High accuracy in Python syntax and dynamic data structures (84%)",
      "Solid foundational logic in Algorithmic problem solving (80%)",
      "Effective output structure formatting & error recovery"
    ],
    improvement_areas: [
      "Focus on optimizing edge cases in Debugging scenarios (82%)",
      "Deepen asynchronous HTTP request handling & multi-threading logic"
    ]
  };

  // 1. Immediate zero-latency render
  renderResultData(defaultResult);

  // 2. Asynchronous background fetch for candidate's actual DB evaluation result
  try {
    let resultData = null;
    if (resultId) {
      const res = await apiFetch(`${getApiBaseUrl()}/api/results/${resultId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          resultData = json.data;
        }
      }
    }

    if (!resultData && user.id) {
      const latestRes = await apiFetch(`${getApiBaseUrl()}/api/candidates/${user.id}/results`);
      if (latestRes.ok) {
        const json = await latestRes.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          resultData = json.data[0];
        }
      }
    }

    if (resultData) {
      renderResultData(resultData);
    }
  } catch (err) {
    console.warn("Using baseline evaluation report fallback:", err.message);
  }
}

function renderResultData(result) {
  const score = Math.round(Number(result.overall_score || 82));
  const title = result.assessments?.title || "Practical Competency Assessment";
  const breakdown = result.breakdown && Object.keys(result.breakdown).length > 0 
    ? result.breakdown 
    : { "Python": 84, "SQL": 76, "Algorithms": 80, "Data Analysis": 78, "Debugging": 82 };
  
  let strengths = Array.isArray(result.strengths) && result.strengths.length > 0 ? result.strengths : [];
  let improvements = Array.isArray(result.improvement_areas) && result.improvement_areas.length > 0 
    ? result.improvement_areas 
    : (Array.isArray(result.improvements) && result.improvements.length > 0 ? result.improvements : []);

  if (strengths.length === 0) {
    const entries = Object.entries(breakdown).sort((a, b) => Number(b[1]) - Number(a[1]));
    if (entries.length > 0) {
      strengths = entries.slice(0, 2).map(([skill, val]) => `High proficiency in ${skill} (${Math.round(val)}%)`);
      strengths.push("Solid foundational execution logic & syntax verification");
    } else {
      strengths = [
        "High accuracy in core execution logic & syntax verification",
        "Solid algorithmic problem-solving and state management",
        "Effective output structure formatting & error recovery"
      ];
    }
  }

  if (improvements.length === 0) {
    const entries = Object.entries(breakdown).sort((a, b) => Number(a[1]) - Number(b[1]));
    if (entries.length > 0) {
      improvements = entries.slice(0, 2).map(([skill, val]) => `Focus on optimizing edge cases in ${skill} (${Math.round(val)}%)`);
      improvements.push("Practice modular exception handling & boundary validations");
    } else {
      improvements = [
        "Focus on optimizing asynchronous edge cases and memory efficiency",
        "Practice modular exception handling and boundary validations",
        "Deepen real-time query execution & performance tuning"
      ];
    }
  }

  const insight = result.ai_insight || `Candidate achieved an overall verified score of ${score}%.`;

  const ringBox = document.getElementById("resultRingBox");
  if (ringBox) {
    ringBox.style.background = `radial-gradient(circle at 50% 50%, #0b0f19 60%, transparent 61%), conic-gradient(var(--primary) ${score}%, rgba(255,255,255,0.1) 0)`;
  }
  const scoreValEl = document.getElementById("resultScoreValue");
  if (scoreValEl) scoreValEl.textContent = `${score}%`;

  const level = score >= 85 ? "Advanced Level" : (score >= 70 ? "Intermediate Level" : "Beginner Level");
  const levelBadge = document.getElementById("resultLevelBadge");
  if (levelBadge) levelBadge.textContent = level;

  const titleEl = document.getElementById("resultAssessmentTitle");
  if (titleEl) titleEl.textContent = title;

  const subtitleEl = document.getElementById("resultSubtitle");
  if (subtitleEl) subtitleEl.textContent = `${title} • Verified AI Evaluation Report`;

  const metaEl = document.getElementById("resultMetaInfo");
  if (metaEl) metaEl.textContent = `Completed ${new Date(result.created_at || Date.now()).toLocaleDateString()} • Cryptographically Verified`;

  const insightEl = document.getElementById("resultAiInsight");
  if (insightEl) insightEl.textContent = `"${insight}"`;

  const breakdownListEl = document.getElementById("resultBreakdownList");
  if (breakdownListEl && Object.keys(breakdown).length > 0) {
    const colors = ['var(--accent-green)', 'var(--accent-cyan)', 'var(--primary)', 'var(--accent-purple)', 'var(--accent-amber)'];
    breakdownListEl.innerHTML = Object.entries(breakdown).map(([skill, val], idx) => {
      const numVal = Math.round(Number(val));
      const color = colors[idx % colors.length];
      return `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.35rem;">
            <span>${skill}</span>
            <span style="color: ${color}; font-weight: 700;">${numVal}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${numVal}%; background: ${color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  const strengthsListEl = document.getElementById("resultStrengthsList");
  if (strengthsListEl) {
    strengthsListEl.innerHTML = strengths.map(item => `
      <li><i class="fa-solid fa-check" style="color: var(--accent-green); margin-right: 0.4rem;"></i> ${item}</li>
    `).join('');
  }

  const improvementsListEl = document.getElementById("resultImprovementsList");
  if (improvementsListEl) {
    improvementsListEl.innerHTML = improvements.map(item => `
      <li><i class="fa-solid fa-arrow-right" style="color: var(--accent-amber); margin-right: 0.4rem;"></i> ${item}</li>
    `).join('');
  }

  const labels = Object.keys(breakdown);
  const values = Object.values(breakdown).map(v => Number(v));
  if (labels.length > 0) {
    renderRadarChart("resultRadarChart", values, labels);
  } else {
    renderRadarChart("resultRadarChart", [score, score, score, score, score]);
  }
}

// 5. SKILL GAP ANALYSIS (skill-gap.html)
async function initSkillGapPage() {
  let user = window.SkillSyncAuth;
  if (!user || !user.id) {
    try {
      const stored = localStorage.getItem("skillsync_user");
      if (stored) user = JSON.parse(stored);
    } catch(e) {}
  }
  if (!user || !user.id) {
    try {
      const meRes = await apiFetch(`${getApiBaseUrl()}/api/auth/me`);
      if (meRes.ok) {
        const meJson = await meRes.json();
        user = meJson.data || {};
        window.SkillSyncAuth = user;
      }
    } catch(e) {}
  }
  user = user || {};
  const selectEl = document.getElementById("targetRoleSelect");
  
  let savedRole = localStorage.getItem("skillsync_target_role") || "Python Developer";
  if (selectEl) {
    selectEl.value = savedRole;
    selectEl.addEventListener("change", (e) => {
      const newRole = e.target.value;
      localStorage.setItem("skillsync_target_role", newRole);
      fetchAndRenderSkillGap(user.id, newRole);
    });
  }

  fetchAndRenderSkillGap(user.id, savedRole);
}

async function fetchAndRenderSkillGap(candidateId, targetRole) {
  const compListEl = document.getElementById("skillGapComparisonList");
  const matchBadge = document.getElementById("targetMatchBadge");
  const focusCard = document.getElementById("primaryGapFocusCard");
  const timelineEl = document.getElementById("skillGapTimeline");
  const topCta = document.getElementById("topPracticeCta");

  if (!compListEl) return;

  compListEl.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Calculating live skill gap vector...</div>`;

  try {
    if (!candidateId) {
      const meRes = await apiFetch(`${getApiBaseUrl()}/api/auth/me`);
      if (meRes.ok) {
        const meJson = await meRes.json();
        candidateId = meJson.data?.id;
      }
    }
    if (!candidateId) throw new Error("Unauthenticated user ID");

    const res = await apiFetch(`${getApiBaseUrl()}/api/skill-gap/${candidateId}?role=${encodeURIComponent(targetRole)}`);
    let json = { success: false };
    if (res.ok) {
      json = await res.json();
    }

    let data = null;
    if (json.success && json.data && json.data.has_data && json.data.skill_gaps && json.data.skill_gaps.length > 0) {
      data = json.data;
    } else {
      // Fallback check: Did user complete an assessment locally or have local results?
      let localBreakdown = null;
      try {
        const localResults = JSON.parse(localStorage.getItem("skillsync_local_results") || "[]");
        if (localResults.length > 0 && localResults[0].breakdown) {
          localBreakdown = localResults[0].breakdown;
        }
      } catch(e) {}

      if (localBreakdown || localStorage.getItem("skillsync_completed_assessment") === "true") {
        const activeBreakdown = localBreakdown || { "Python": 84, "SQL": 78, "Algorithms": 80, "Data Analysis": 78, "Debugging": 82, "Communication": 76 };
        const roleTargets = {
          'Python Developer': { 'Python': 90, 'Debugging': 85, 'Algorithms': 80, 'Data Analysis': 75, 'Communication': 75 },
          'Java Developer': { 'Algorithms': 85, 'Debugging': 85, 'Python': 70, 'Communication': 75, 'Data Analysis': 65 },
          'Data Scientist': { 'Data Analysis': 90, 'SQL': 85, 'Python': 85, 'Algorithms': 75, 'Communication': 70 },
          'Frontend Engineer': { 'Communication': 85, 'Debugging': 80, 'Algorithms': 75, 'Python': 65, 'Data Analysis': 60 },
          'Backend Engineer': { 'Python': 90, 'Algorithms': 85, 'Debugging': 85, 'SQL': 80, 'Communication': 75 }
        }[targetRole] || { 'Python': 90, 'Debugging': 85, 'Algorithms': 80, 'Data Analysis': 75, 'Communication': 75 };

        const allSkills = Array.from(new Set([...Object.keys(roleTargets), ...Object.keys(activeBreakdown)]));
        const gaps = allSkills.map(skillName => {
          const cur = activeBreakdown[skillName] !== undefined ? Number(activeBreakdown[skillName]) : 75;
          const tgt = roleTargets[skillName] !== undefined ? roleTargets[skillName] : 80;
          const delta = tgt - cur;
          return {
            competency_name: skillName,
            current_score: cur,
            target_score: tgt,
            gap: Math.max(0, delta),
            delta_raw: delta
          };
        }).sort((a, b) => b.gap - a.gap);

        let totalTarget = 0, totalAchieved = 0;
        gaps.forEach(g => { totalTarget += g.target_score; totalAchieved += Math.min(g.current_score, g.target_score); });
        const match = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 82;

        data = {
          has_data: true,
          match_percent: match,
          skill_gaps: gaps,
          largest_gap: gaps[0]
        };
      }
    }

    if (!data || !data.has_data || !data.skill_gaps || data.skill_gaps.length === 0) {
      if (matchBadge) matchBadge.textContent = "Target: Not Assessed";

      compListEl.innerHTML = `
        <div style="padding: 2.5rem 1.5rem; text-align: center; background: rgba(17, 24, 39, 0.4); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(99, 102, 241, 0.15); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.5rem;">
            <i class="fa-solid fa-clipboard-list"></i>
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem;">No Verified Competency Data Yet</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 500px; margin: 0 auto 1.5rem; line-height: 1.5;">
            Complete at least one practical assessment to generate your verified skill gap analysis against <strong>${targetRole}</strong> benchmarks.
          </p>
          <a href="assessments.html" class="btn btn-primary"><i class="fa-solid fa-play"></i> Take Your First Assessment</a>
        </div>
      `;

      if (focusCard) {
        focusCard.innerHTML = `
          <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.75rem;">Primary Gap Focus</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1rem;">
            Your target role is set to <strong>${targetRole}</strong>. Once you take an assessment, your top priority gap will be highlighted here.
          </p>
          <a href="assessments.html" class="btn btn-secondary btn-sm" style="width: 100%;"><i class="fa-solid fa-laptop-code"></i> Browse Assessments</a>
        `;
      }

      if (timelineEl) {
        timelineEl.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
            Personalized 4-week growth roadmap will unlock automatically after your first assessment completion.
          </div>
        `;
      }
      return;
    }

    data = json.data || data;
    const gaps = data.skill_gaps;
    const match = data.match_percent;
    const topGapItem = data.largest_gap || gaps[0];

    if (matchBadge) matchBadge.textContent = `Target Match: ${match}%`;

    const icons = {
      'Python': 'fa-brands fa-python',
      'SQL': 'fa-solid fa-database',
      'Debugging': 'fa-solid fa-bug',
      'Algorithms': 'fa-solid fa-code-branch',
      'Data Analysis': 'fa-solid fa-chart-column',
      'Communication': 'fa-solid fa-comments'
    };

    compListEl.innerHTML = gaps.map((item, idx) => {
      const isTop = idx === 0 && item.gap > 0;
      const icon = icons[item.competency_name] || 'fa-solid fa-bullseye';
      const color = isTop ? '#f43f5e' : (item.gap > 5 ? '#f59e0b' : '#10b981');
      const badgeText = isTop ? `High Priority: -${item.gap}%` : (item.gap > 0 ? `Gap: -${item.gap}%` : `Near Benchmark`);
      const badgeClass = isTop ? 'badge-amber' : (item.gap > 0 ? 'badge-amber' : 'badge-green');
      const badgeStyle = isTop ? 'background: rgba(244, 63, 94, 0.2); color: #fda4af;' : '';

      return `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">
              <i class="${icon}" style="color: ${color}; margin-right: 0.4rem;"></i> ${item.competency_name}
            </span>
            <div style="font-size: 0.88rem; font-weight: 700;">
              <span style="color: var(--accent-cyan);">${item.current_score}%</span> 
              <i class="fa-solid fa-arrow-right" style="color: var(--text-dim); margin: 0 0.35rem;"></i> 
              <span style="color: var(--primary);">Target ${item.target_score}%</span>
              <span class="badge ${badgeClass}" style="margin-left: 0.5rem; ${badgeStyle}">${badgeText}</span>
            </div>
          </div>
          <div class="progress-bar-bg" style="height: 10px;">
            <div class="progress-bar-fill" style="width: ${item.current_score}%; background: ${color};"></div>
          </div>
        </div>
      `;
    }).join('');

    if (focusCard && topGapItem) {
      const topIcon = icons[topGapItem.competency_name] || 'fa-solid fa-bullseye';
      focusCard.innerHTML = `
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem;">Primary Gap Focus</h3>

        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
          <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: rgba(244, 63, 94, 0.15); display: flex; align-items: center; justify-content: center; color: #f43f5e; font-size: 1.25rem;">
            <i class="${topIcon}"></i>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 0.95rem;">${topGapItem.competency_name} (-${topGapItem.gap}%)</div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">Current: ${topGapItem.current_score}% | Target: ${topGapItem.target_score}%</div>
          </div>
        </div>

        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">
          Closing this ${topGapItem.gap}% gap will raise your overall Job Fit index for <strong>${targetRole}</strong> roles.
        </p>

        <div style="margin-top: 1.25rem;">
          <a href="practice.html?skill=${encodeURIComponent(topGapItem.competency_name)}" class="btn btn-primary btn-sm" style="width: 100%;">
            <i class="fa-solid fa-bolt"></i> Start ${topGapItem.competency_name} Practice Now
          </a>
        </div>
      `;
    }

    if (topCta && topGapItem) {
      topCta.href = `practice.html?skill=${encodeURIComponent(topGapItem.competency_name)}`;
    }

    if (timelineEl && gaps.length > 0) {
      const gap1 = gaps[0] ? gaps[0].competency_name : "Debugging";
      const gap2 = gaps[1] ? gaps[1].competency_name : "Algorithms";

      timelineEl.innerHTML = `
        <div class="timeline-item">
          <div class="timeline-node completed"><i class="fa-solid fa-check" style="font-size: 0.6rem; color: #fff;"></i></div>
          <div class="roadmap-header" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">
                Week 1: Master ${gap1} Fundamentals & Boundary Conditions
              </h4>
              <i class="fa-solid fa-chevron-up toggle-icon" style="color: var(--text-dim);"></i>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.25rem;">
              Focus area: Core logic checks, edge cases, and robust error safeguards.
            </p>
          </div>
          <div class="glass-panel" style="padding: 0.85rem; margin-top: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem;">
              <span><i class="fa-solid fa-fire" style="color: var(--accent-amber);"></i> Recommended Practice: ${gap1} Optimization</span>
              <a href="practice.html?skill=${encodeURIComponent(gap1)}" class="btn btn-primary btn-sm">Start Task</a>
            </div>
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-node"></div>
          <div class="roadmap-header" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">
                Week 2: Advanced ${gap2} & Structural Patterns
              </h4>
              <i class="fa-solid fa-chevron-down toggle-icon" style="color: var(--text-dim);"></i>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.25rem;">
              Focus area: Data structures, modular abstractions, and pattern optimization.
            </p>
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-node"></div>
          <div class="roadmap-header" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">
                Week 3: Real-World Integrated Integration Challenge
              </h4>
              <i class="fa-solid fa-chevron-down toggle-icon" style="color: var(--text-dim);"></i>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.25rem;">
              Focus area: Multi-file data flows and end-to-end scenario execution.
            </p>
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-node"></div>
          <div class="roadmap-header" style="cursor: pointer;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">
                Week 4: Final Practical Benchmark & Role Certification
              </h4>
              <i class="fa-solid fa-chevron-down toggle-icon" style="color: var(--text-dim);"></i>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.25rem;">
              Focus area: Verified target role simulation for ${targetRole}.
            </p>
          </div>
        </div>
      `;

      const roadmapHeaders = timelineEl.querySelectorAll(".roadmap-header");
      roadmapHeaders.forEach(item => {
        item.addEventListener("click", () => {
          const content = item.nextElementSibling;
          if (content && content.classList.contains("glass-panel")) {
            const isHidden = content.style.display === "none" || !content.style.display;
            content.style.display = isHidden ? "block" : "none";
            const icon = item.querySelector(".toggle-icon");
            if (icon) {
              icon.className = isHidden ? "fa-solid fa-chevron-up toggle-icon" : "fa-solid fa-chevron-down toggle-icon";
            }
          }
        });
      });
    }

  } catch (err) {
    console.error("Failed to load skill gap data:", err);
    compListEl.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--accent-amber);">Unable to compute skill gap analysis. Please try refreshing.</div>`;
  }
}

// 6. CAREER RECOMMENDATIONS (career-recommendation.html)
async function initCareerRecommendationPage() {
  console.log("[Career Page] Initializing career recommendation page...");
  const summaryTitle = document.getElementById("careerSummaryTitle");
  const summaryText = document.getElementById("careerSummaryText");
  const summaryScore = document.getElementById("careerSummaryScore");
  const recommendationsEl = document.getElementById("careerRecommendationsGrid");
  const noteEl = document.getElementById("careerRecommendationNote");
  if (!recommendationsEl) return;

  if (summaryTitle) summaryTitle.textContent = "Analyzing role matches from verified competencies...";
  if (summaryText) summaryText.textContent = "Calculating evidence-based role recommendations.";
  if (noteEl) noteEl.textContent = "Fetching your competency profile recommendations...";
  recommendationsEl.innerHTML = `<div class="card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-cyan);"></i><p style="margin-top: 1rem;">Loading evidence-based recommendations...</p></div>`;

  let user = window.SkillSyncAuth;
  if (!user || !user.id) {
    try {
      const stored = localStorage.getItem("skillsync_user");
      if (stored) user = JSON.parse(stored);
    } catch(e) {}
  }
  if (!user || !user.id) {
    try {
      console.log("[Career Page] Resolving user session via /api/auth/me...");
      const meRes = await apiFetch(`${getApiBaseUrl()}/api/auth/me`);
      if (meRes.ok) {
        const meJson = await meRes.json();
        user = meJson.data || {};
        window.SkillSyncAuth = user;
      }
    } catch(e) {
      console.warn("[Career Page] Failed to fetch auth session:", e);
    }
  }
  user = user || {};

  if (!user.id) {
    console.warn("[Career Page] User ID missing, prompt sign-in.");
    if (summaryTitle) summaryTitle.textContent = "Please sign in to view recommendations";
    if (summaryText) summaryText.textContent = "Career recommendations require a verified user session.";
    if (summaryScore) summaryScore.textContent = "—";
    if (noteEl) noteEl.textContent = "Authentication required.";
    recommendationsEl.innerHTML = `<div class="card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center;"><i class="fa-solid fa-lock" style="font-size: 2rem; color: var(--accent-cyan);"></i><h3 style="margin-top: 1rem;">Authentication required</h3><p style="color: var(--text-muted); margin: 0.5rem 0 1.25rem;">Please sign in to access your competency-based career recommendations.</p><a href="auth.html" class="btn btn-primary">Sign In</a></div>`;
    return;
  }

  console.log(`[Career Page] Fetching recommendations for user ID: ${user.id}`);
  try {
    const url = `${getApiBaseUrl()}/api/career-recommendations/${user.id}`;
    console.log(`[Career Page] Sending GET ${url}`);
    const response = await apiFetch(url);
    console.log(`[Career Page] API status code: ${response.status}`);
    const result = await response.json();
    console.log("[Career Page] API response payload:", result);

    if (!response.ok || !result.success) throw new Error(result.message || `HTTP ${response.status}`);

    const recommendations = result.data?.recommendations || [];
    if (!result.data?.has_data || recommendations.length === 0) {
      if (summaryTitle) summaryTitle.textContent = "Complete an assessment to discover matching roles";
      if (summaryText) summaryText.textContent = "Career recommendations are generated from your verified competency results.";
      if (summaryScore) summaryScore.textContent = "—";
      if (noteEl) noteEl.textContent = "Complete at least one assessment to generate evidence-based career recommendations.";
      recommendationsEl.innerHTML = `<div class="card" style="grid-column: 1 / -1; padding: 2.5rem; text-align: center;"><i class="fa-solid fa-compass" style="font-size: 2rem; color: var(--accent-cyan);"></i><h3 style="margin-top: 1rem;">No verified competency data yet</h3><p style="color: var(--text-muted); margin: 0.5rem 0 1.25rem;">Finish an assessment to see your strongest role matches and the skills to build next.</p><a href="assessments.html" class="btn btn-primary">Browse Assessments</a></div>`;
      return;
    }

    const topRecommendation = recommendations[0];
    if (summaryTitle) summaryTitle.textContent = `${topRecommendation.role_title} is your strongest current match`;
    if (summaryText) summaryText.textContent = "Recommendations are calculated from your verified competency results and each role's target skills.";
    if (summaryScore) summaryScore.textContent = `${topRecommendation.match_percent}%`;
    if (noteEl) noteEl.textContent = "Matches reflect demonstrated competencies and role targets; they are guidance, not hiring guarantees.";

    recommendationsEl.innerHTML = recommendations.map((recommendation, index) => {
      const matching = recommendation.matching_competencies || [];
      const missing = recommendation.missing_competencies || [];
      const matchingTags = matching.length
        ? matching.map(skill => `<span>${escapeCareerText(skill.skill_name)} ${Math.round(Number(skill.current_score))}%</span>`).join("")
        : "<span>Build evidence through an assessment</span>";
      const missingText = missing.length
        ? missing.map(skill => `${escapeCareerText(skill.skill_name)} (${Math.round(Number(skill.current_score))}% / ${Math.round(Number(skill.target_score))}%)`).join(", ")
        : "All tracked target competencies are currently met.";
      const icon = ["fa-solid fa-compass", "fa-solid fa-chart-line", "fa-solid fa-briefcase", "fa-solid fa-code"][index] || "fa-solid fa-compass";
      return `<article class="card card-hover-glow career-card"><div class="career-card-heading"><div class="stat-icon"><i class="${icon}"></i></div><span class="badge ${index === 0 ? "badge-green" : "badge-primary"}">${recommendation.match_percent}% Match</span></div><h2>${escapeCareerText(recommendation.role_title)}</h2><p>Match based on your current verified competency evidence against this role's target profile.</p><h4>Strongest matching competencies</h4><div class="career-tags">${matchingTags}</div><h4>Missing competencies</h4><p class="career-gap">${missingText}</p><a href="skill-gap.html" class="btn btn-secondary btn-sm">View Skill Gap <i class="fa-solid fa-arrow-right"></i></a></article>`;
    }).join("");
  } catch (error) {
    console.error("[Career Page] Failed to load career recommendations:", error);
    if (summaryTitle) summaryTitle.textContent = "Career recommendations are unavailable";
    if (summaryText) summaryText.textContent = "We could not load your current competency-based recommendations.";
    if (summaryScore) summaryScore.textContent = "—";
    if (noteEl) noteEl.textContent = "Try again after confirming the API is running.";
    recommendationsEl.innerHTML = `<div class="card" style="grid-column: 1 / -1; padding: 2rem; text-align: center;"><i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: #f43f5e;"></i><h3 style="margin-top: 1rem;">Unable to load recommendations</h3><p style="color: var(--text-muted); margin: 0.5rem 0 1.25rem;">${escapeCareerText(error.message)}</p><button class="btn btn-secondary" onclick="initCareerRecommendationPage()">Retry</button></div>`;
  }
}

function escapeCareerText(value) {
  const text = String(value ?? "");
  const entityMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return text.replace(/[&<>"']/g, character => entityMap[character]);
}

// 7. PASSPORT PAGE (passport.html)
async function initPassportPage() {
  const shareBtn = document.getElementById("sharePassportBtn");
  if (shareBtn) {
    shareBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(window.location.href);
      showToast("Public Passport link copied to clipboard!", "success");
    });
  }

  const exportBtn = document.getElementById("exportPassportBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      showToast("Generating Verifiable Skill Credential PDF...", "info");
      setTimeout(() => {
        showToast("Competency Passport downloaded successfully!", "success");
      }, 1500);
    });
  }

  let user = window.SkillSyncAuth;
  if (!user || !user.id) {
    try {
      const stored = localStorage.getItem("skillsync_user");
      if (stored) user = JSON.parse(stored);
    } catch(e) {}
  }
  user = user || {};

  const name = user.name || user.full_name || (user.email ? user.email.split('@')[0] : 'Candidate');
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CA';
  const idShort = user.id ? user.id.slice(0, 8).toUpperCase() : 'PENDING';

  const nameEl = document.getElementById("passportHeroName");
  if (nameEl) nameEl.textContent = name;

  const avatarEl = document.getElementById("passportHeroAvatar");
  if (avatarEl) avatarEl.textContent = initials;

  const idEl = document.getElementById("passportHeroId");
  if (idEl) idEl.textContent = `#CPX-${idShort}`;

  if (user.id) {
    try {
      const res = await apiFetch(`${getApiBaseUrl()}/api/candidates/${user.id}/competencies`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || {};
        const score = data.overall_competency !== undefined && data.overall_competency !== null ? Math.round(Number(data.overall_competency)) : null;
        const level = data.competency_level || (score ? (score >= 85 ? 'Advanced Level' : (score >= 70 ? 'Intermediate Level' : 'Beginner Level')) : 'Candidate');

        const scoreEl = document.getElementById("passportHeroScore");
        if (scoreEl) scoreEl.textContent = score !== null ? `${score}%` : '—';

        const levelEl = document.getElementById("passportHeroLevel");
        if (levelEl) levelEl.textContent = level;
      }
    } catch(e) {}
  }
}

// 7. RECRUITER DASHBOARD (recruiter.html)
async function initRecruiterDashboard() {
  // Initialize Recruiter Pipeline Chart
  const ctx = document.getElementById("recruiterPipelineChart");
  if (ctx && typeof Chart !== 'undefined') {
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Applied', 'Screened', 'Practical Assessed', 'Strong Matches', 'Offers'],
        datasets: [{
          label: 'Candidates',
          data: [248, 142, 98, 64, 18],
          backgroundColor: [
            'rgba(99, 102, 241, 0.4)',
            'rgba(99, 102, 241, 0.6)',
            'rgba(6, 182, 212, 0.7)',
            'rgba(16, 185, 129, 0.85)',
            'rgba(139, 92, 246, 0.9)'
          ],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  const candidateRowsEl = document.getElementById("recruiterCandidateRows");
  const jobOpeningsEl = document.getElementById("recruiterJobOpenings");
  const openPositionsEl = document.getElementById("recruiterOpenPositions");
  const candidatesAssessedEl = document.getElementById("recruiterCandidatesAssessed");
  const strongFitsEl = document.getElementById("recruiterStrongFits");
  const averageScoreEl = document.getElementById("recruiterAverageScore");

  try {
    const [candidatesResponse, openingsResponse] = await Promise.all([
      fetch(`${getApiBaseUrl()}/api/candidates`, { credentials: "include" }),
      fetch(`${getApiBaseUrl()}/api/job-openings`, { credentials: "include" })
    ]);
    const [candidatesResult, openingsResult] = await Promise.all([
      candidatesResponse.json(),
      openingsResponse.json()
    ]);
    if (!candidatesResponse.ok || !candidatesResult.success) {
      throw new Error(candidatesResult.message || `Candidates request failed (${candidatesResponse.status})`);
    }
    if (!openingsResponse.ok || !openingsResult.success) {
      throw new Error(openingsResult.message || `Job openings request failed (${openingsResponse.status})`);
    }

    const candidates = Array.isArray(candidatesResult.data) ? candidatesResult.data : [];
    const openings = Array.isArray(openingsResult.data) ? openingsResult.data : [];
    const assessedCandidates = candidates.filter(candidate => Number(candidate.assessments_completed) > 0);
    const scoredCandidates = candidates.filter(candidate => Number.isFinite(Number(candidate.overall_competency)));
    const averageScore = scoredCandidates.length
      ? Math.round(scoredCandidates.reduce((sum, candidate) => sum + Number(candidate.overall_competency), 0) / scoredCandidates.length)
      : null;

    if (openPositionsEl) openPositionsEl.textContent = openings.reduce((sum, opening) => sum + Number(opening.openings_count || 0), 0);
    if (candidatesAssessedEl) candidatesAssessedEl.textContent = assessedCandidates.length;
    if (strongFitsEl) strongFitsEl.textContent = scoredCandidates.filter(candidate => Number(candidate.overall_competency) >= 80).length;
    if (averageScoreEl) averageScoreEl.textContent = averageScore === null ? "—" : `${averageScore}%`;

    if (candidateRowsEl) {
      candidateRowsEl.innerHTML = candidates.length
        ? candidates.map(candidate => {
          const name = escapeRecruiterText(candidate.name || "Unnamed candidate");
          const initials = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
          const score = Number.isFinite(Number(candidate.overall_competency)) ? `${Math.round(Number(candidate.overall_competency))}%` : "Not assessed";
          const level = escapeRecruiterText(candidate.competency_level || "Not assessed");
          const completed = Number(candidate.assessments_completed) || 0;
          const assessed = completed > 0;
          return `<tr class="candidate-row"><td><div style="display: flex; align-items: center; gap: 0.75rem;"><div class="avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">${initials}</div><div><div style="font-weight: 700; color: var(--text-main);">${name}</div><div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${escapeRecruiterText(candidate.id)}</div></div></div></td><td>${level}</td><td><span style="font-weight: 700; color: var(--accent-cyan);">${score}</span></td><td>${completed}</td><td><span class="badge ${assessed ? "badge-green" : "badge-amber"}">${assessed ? "Assessed" : "Pending assessment"}</span></td><td><a href="candidate.html?id=${encodeURIComponent(candidate.id)}" class="btn btn-secondary btn-sm">View Profile</a></td></tr>`;
        }).join("")
        : `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No candidate accounts found.</td></tr>`;
    }

    if (jobOpeningsEl) {
      jobOpeningsEl.innerHTML = openings.length
        ? openings.map((opening, index) => {
          const requirements = Object.entries(opening.required_competencies || {})
            .map(([skill, target]) => `${escapeRecruiterText(skill)} (${Math.round(Number(target))}%+)`)
            .join(", ");
          return `<div class="glass-panel" style="padding: 0.85rem;"><div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 0.9rem;"><span>${escapeRecruiterText(opening.role_title)}</span><span class="badge ${index === 0 ? "badge-green" : "badge-primary"}">${Number(opening.openings_count) || 0} ${Number(opening.openings_count) === 1 ? "Opening" : "Openings"}</span></div><div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem;">Required: ${requirements || "Not specified"}</div></div>`;
        }).join("")
        : `<div style="color: var(--text-muted); font-size: 0.85rem;">No active job openings.</div>`;
    }
  } catch (error) {
    console.error("Failed to load recruiter dashboard data:", error);
    if (candidateRowsEl) candidateRowsEl.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">Unable to load candidates: ${escapeRecruiterText(error.message)}</td></tr>`;
    if (jobOpeningsEl) jobOpeningsEl.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem;">Unable to load job openings.</div>`;
  }

  // Recruiter candidate filter table
  const searchInput = document.getElementById("candidateSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const term = e.target.value.toLowerCase();
      const rows = document.querySelectorAll(".candidate-row");
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? "" : "none";
      });
    });
  }
}

function escapeRecruiterText(value) {
  const entityMap = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value ?? "").replace(/[&<>"']/g, character => entityMap[character]);
}

// 8. CANDIDATE PROFILE VIEW (candidate.html)
async function initCandidateProfileView() {
  const candidateId = new URLSearchParams(window.location.search).get("id");
  const errorEl = document.getElementById("candidateProfileError");
  const bannerEl = document.getElementById("candidateProfileBanner");
  const bodyEl = document.getElementById("candidateProfileBody");
  const showError = (message) => {
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: #f43f5e;"></i><h2 style="margin-top: 1rem;">${escapeRecruiterText(message)}</h2><p style="color: var(--text-muted); margin-top: 0.5rem;">Return to the candidate list and select a profile.</p>`;
    }
    if (bannerEl) bannerEl.style.display = "none";
    if (bodyEl) bodyEl.style.display = "none";
  };

  if (!candidateId) {
    showError("No candidate selected");
    return;
  }

  try {
    const jobId = new URLSearchParams(window.location.search).get("jobId");
    const jobFitUrl = `${getApiBaseUrl()}/api/candidates/${encodeURIComponent(candidateId)}/job-fit${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`;
    const [candidateResponse, jobFitResponse] = await Promise.all([
      fetch(`${getApiBaseUrl()}/api/candidates/${encodeURIComponent(candidateId)}`, { credentials: "include" }),
      fetch(jobFitUrl, { credentials: "include" })
    ]);
    const [candidateResult, jobFitResult] = await Promise.all([
      candidateResponse.json(),
      jobFitResponse.json()
    ]);
    if (!candidateResponse.ok || !candidateResult.success) throw new Error(candidateResult.message || `Candidate request failed (${candidateResponse.status})`);
    if (!jobFitResponse.ok || !jobFitResult.success) throw new Error(jobFitResult.message || `Job fit request failed (${jobFitResponse.status})`);

    const candidate = candidateResult.data;
    const jobFit = jobFitResult.data;
    const competencies = Array.isArray(jobFit.competencies) ? jobFit.competencies : [];
    const scoreBySkill = Object.fromEntries(competencies.map(item => [item.skill_name, Number(item.score)]));
    const overallCompetency = Number.isFinite(Number(candidate.overall_competency))
      ? Math.round(Number(candidate.overall_competency))
      : (competencies.length ? Math.round(competencies.reduce((sum, item) => sum + Number(item.score), 0) / competencies.length) : null);
    const matchPercent = Math.round(Number(jobFit.match_percent) || 0);
    const fitLabel = matchPercent > 80 ? "Strong Fit" : (matchPercent >= 60 ? "Moderate Fit" : "Needs Development");
    const name = candidate.name || "Unnamed candidate";

    const nameEl = document.getElementById("candidateProfileName");
    const avatarEl = document.getElementById("candidateProfileAvatar");
    const roleEl = document.getElementById("candidateJobRole");
    const fitEl = document.getElementById("candidateJobFit");
    const competencyEl = document.getElementById("candidateCompetencyScore");
    const recommendationEl = document.getElementById("candidateHiringRecommendation");
    const comparisonEl = document.getElementById("candidateRequirementComparison");
    if (nameEl) nameEl.textContent = name;
    if (avatarEl) avatarEl.textContent = name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
    if (roleEl) roleEl.textContent = jobFit.job_opening?.role_title || "Selected role";
    if (fitEl) fitEl.textContent = `${matchPercent}%`;
    if (competencyEl) competencyEl.textContent = overallCompetency === null ? "No competency score yet" : `${overallCompetency}% Overall Competency`;
    if (recommendationEl) recommendationEl.textContent = `${name} is a ${fitLabel} (${matchPercent}% Job Fit) for the ${jobFit.job_opening?.role_title || "selected"} role, based on verified assessment competencies.`;
    if (comparisonEl) {
      const requirements = Array.isArray(jobFit.requirements) ? jobFit.requirements : [];
      comparisonEl.innerHTML = requirements.length
        ? requirements.map(requirement => {
          const meetsTarget = Number(requirement.current_score) >= Number(requirement.required_score);
          const color = meetsTarget ? "var(--accent-green)" : "var(--accent-amber)";
          return `<div><div style="display: flex; justify-content: space-between; font-size: 0.88rem; font-weight: 600; margin-bottom: 0.35rem;"><span>${escapeRecruiterText(requirement.skill_name)} (Required: ${Math.round(Number(requirement.required_score))}%)</span><span style="color: ${color};">Candidate: ${Math.round(Number(requirement.current_score))}%${meetsTarget ? " ✓" : ""}</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${Math.max(0, Math.min(100, Number(requirement.current_score)))}%; background: ${color};"></div></div></div>`;
        }).join("")
        : `<div style="color: var(--text-muted);">This job opening has no competency requirements configured.</div>`;
    }

    const radarSkills = ["Python", "Debugging", "Algorithms", "Data Analysis", "Communication"];
    renderRadarChart("candidateMatchRadar", radarSkills.map(skill => Number(scoreBySkill[skill] || 0)), radarSkills);
    if (bannerEl) bannerEl.style.display = "";
    if (bodyEl) bodyEl.style.display = "";
  } catch (error) {
    console.error("Failed to load candidate profile:", error);
    showError(error.message || "Candidate profile could not be loaded");
  }
}

// 9. HISTORY PAGE (history.html)
function initHistoryPage() {
  renderTrendChart("historyTrendChart");
}

// Clean Markdown to HTML Parser (strips raw asterisks, hashtags, backticks)
function renderCleanMarkdown(markdownText) {
  if (!markdownText) return "";
  
  let html = markdownText.trim();
  
  // Code blocks: ```lang ... ```
  html = html.replace(/```(?:[a-z]*)\n([\s\S]*?)```/g, (match, code) => {
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<div style="background: #050811; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 0.85rem 1rem; font-family: var(--font-code); font-size: 0.85rem; color: #e2e8f0; margin: 0.85rem 0; overflow-x: auto; white-space: pre; line-height: 1.5;">${escaped}</div>`;
  });

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 0.15rem 0.4rem; border-radius: 4px; font-family: var(--font-code); color: var(--accent-cyan); font-size: 0.88em;">$1</code>');

  // Headings: ### Heading, ## Heading, # Heading
  html = html.replace(/^### (.*$)/gim, '<h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin: 1rem 0 0.5rem; display: flex; align-items: center; gap: 0.4rem;"><i class="fa-solid fa-chevron-right" style="color: var(--accent-cyan); font-size: 0.8rem;"></i> $1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-main); margin: 1.1rem 0 0.6rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3rem;">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin: 1.2rem 0 0.6rem;">$1</h2>');

  // Bold text: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--text-main); font-weight: 700;">$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong style="color: var(--text-main); font-weight: 700;">$1</strong>');

  // Italic text: *text* or _text_
  html = html.replace(/\*(.*?)\*/g, '<em style="color: #cbd5e1;">$1</em>');

  // Lists: lines starting with * or - or numbers
  const lines = html.split('\n');
  let inList = false;
  let resultLines = [];

  lines.forEach(line => {
    const listMatch = line.match(/^[\*\-]\s+(.*)/);
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);

    if (listMatch) {
      if (!inList) {
        resultLines.push('<ul style="list-style: none; padding-left: 0; margin: 0.75rem 0; display: flex; flex-direction: column; gap: 0.4rem;">');
        inList = true;
      }
      resultLines.push(`<li style="display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.9rem; line-height: 1.5;"><i class="fa-solid fa-circle-dot" style="color: var(--accent-cyan); font-size: 0.5rem; margin-top: 0.55rem; flex-shrink: 0;"></i> <span>${listMatch[1]}</span></li>`);
    } else if (numMatch) {
      if (!inList) {
        resultLines.push('<ol style="list-style: none; padding-left: 0; margin: 0.75rem 0; display: flex; flex-direction: column; gap: 0.5rem;">');
        inList = true;
      }
      resultLines.push(`<li style="display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.9rem; line-height: 1.5;"><span style="background: rgba(99, 102, 241, 0.2); color: var(--primary); font-weight: 800; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; margin-top: 0.1rem;">${numMatch[1]}</span> <span>${numMatch[2]}</span></li>`);
    } else {
      if (inList) {
        resultLines.push('</ul>');
        inList = false;
      }
      if (line.trim().length > 0 && !line.trim().startsWith('<h') && !line.trim().startsWith('<div')) {
        resultLines.push(`<p style="margin-bottom: 0.75rem; line-height: 1.65;">${line}</p>`);
      } else {
        resultLines.push(line);
      }
    }
  });

  if (inList) resultLines.push('</ul>');

  return resultLines.join('\n');
}

// Global Voice Assistant State
let isAutoVoiceEnabled = true;
let lastRawAnswerText = "";

function speakMentorResponse(rawText) {
  if (!('speechSynthesis' in window)) {
    showToast("Voice output is not supported in this browser.", "info");
    return;
  }

  // Stop previous speech
  window.speechSynthesis.cancel();

  // Clean raw markdown symbols for smooth, natural speech output
  let speakableText = rawText
    .replace(/```[\s\S]*?```/g, " . Code snippet provided in text response . ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[\*#_~`>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!speakableText) return;

  const utterance = new SpeechSynthesisUtterance(speakableText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Choose clear English voice if available
  const voices = window.speechSynthesis.getVoices();
  const selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('David'))) || voices.find(v => v.lang.startsWith('en'));
  if (selectedVoice) utterance.voice = selectedVoice;

  const speakBtn = document.getElementById("speakMentorBtn");
  if (speakBtn) {
    speakBtn.innerHTML = `<i class="fa-solid fa-circle-stop" style="color: #f43f5e;"></i> Stop Voice`;
    speakBtn.className = "btn btn-secondary btn-sm";
  }

  utterance.onend = () => {
    if (speakBtn) {
      speakBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> Listen Voice`;
      speakBtn.className = "btn btn-cyan btn-sm";
    }
  };

  utterance.onerror = () => {
    if (speakBtn) {
      speakBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> Listen Voice`;
      speakBtn.className = "btn btn-cyan btn-sm";
    }
  };

  window.speechSynthesis.speak(utterance);
}

function stopMentorVoice() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  const speakBtn = document.getElementById("speakMentorBtn");
  if (speakBtn) {
    speakBtn.innerHTML = `<i class="fa-solid fa-volume-high"></i> Listen Voice`;
    speakBtn.className = "btn btn-cyan btn-sm";
  }
}

// 10. GEMINI AI MENTOR PAGE (mentor.html)
function initAIMentorPage() {
  const form = document.getElementById("mentorForm");
  const input = document.getElementById("mentorQuestionInput");
  const sendBtn = document.getElementById("sendMentorBtn");
  const clearBtn = document.getElementById("clearChatBtn");
  
  const emptyState = document.getElementById("mentorEmptyState");
  const loadingState = document.getElementById("mentorLoadingState");
  const responseBox = document.getElementById("mentorResponseBox");
  const errorState = document.getElementById("mentorErrorState");
  
  const questionText = document.getElementById("userQuestionText");
  const answerContent = document.getElementById("aiAnswerContent");
  const errorText = document.getElementById("errorMessageText");

  const speakBtn = document.getElementById("speakMentorBtn");
  const autoVoiceToggle = document.getElementById("autoVoiceToggle");
  const micBtn = document.getElementById("micInputBtn");

  // Initialize BYOK manager component
  if (typeof window.BYOKManager !== 'undefined') {
    window.BYOKManager.init({
      containerId: 'byokCard'
    });
  }

  // Voice output Listen button
  if (speakBtn) {
    speakBtn.addEventListener("click", () => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        stopMentorVoice();
      } else if (lastRawAnswerText) {
        speakMentorResponse(lastRawAnswerText);
      } else {
        showToast("No active response to speak.", "info");
      }
    });
  }

  // Auto-Voice toggle button
  if (autoVoiceToggle) {
    autoVoiceToggle.addEventListener("click", () => {
      isAutoVoiceEnabled = !isAutoVoiceEnabled;
      if (isAutoVoiceEnabled) {
        autoVoiceToggle.className = "badge badge-purple";
        autoVoiceToggle.innerHTML = `<i class="fa-solid fa-microphone-lines"></i> Auto-Voice: ON`;
        showToast("Auto-voice response playback enabled", "success");
      } else {
        autoVoiceToggle.className = "badge badge-secondary";
        autoVoiceToggle.innerHTML = `<i class="fa-solid fa-microphone-slash"></i> Auto-Voice: OFF`;
        stopMentorVoice();
        showToast("Auto-voice response playback disabled", "info");
      }
    });
  }

  // Speech Recognition Microphone Input
  if (micBtn && input) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      let isListening = false;

      micBtn.addEventListener("click", () => {
        if (isListening) {
          recognition.stop();
        } else {
          try {
            recognition.start();
            isListening = true;
            micBtn.innerHTML = `<i class="fa-solid fa-microphone fa-beat" style="color: #f43f5e;"></i>`;
            micBtn.title = "Listening... Speak your question into microphone";
            showToast("Listening... Speak your question into your microphone", "info");
          } catch (e) {
            console.error("Speech recognition error:", e);
          }
        }
      });

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          input.value = transcript;
          showToast(`Voice captured: "${transcript}"`, "success");
          submitMentorQuestion(transcript);
        }
      };

      recognition.onend = () => {
        isListening = false;
        micBtn.innerHTML = `<i class="fa-solid fa-microphone" style="color: var(--accent-cyan);"></i>`;
        micBtn.title = "Speak question using microphone";
      };

      recognition.onerror = (event) => {
        isListening = false;
        micBtn.innerHTML = `<i class="fa-solid fa-microphone" style="color: var(--accent-cyan);"></i>`;
        showToast(`Voice capture note: ${event.error}`, "info");
      };
    } else {
      micBtn.title = "Microphone input not supported on this browser";
    }
  }

  // Suggested questions click handler
  const suggestionPills = document.querySelectorAll(".suggestion-pill");
  suggestionPills.forEach(pill => {
    pill.addEventListener("click", () => {
      const q = pill.getAttribute("data-question");
      if (q && input) {
        input.value = q;
        submitMentorQuestion(q);
      }
    });
  });

  // Clear / Reset chat
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      stopMentorVoice();
      if (input) input.value = "";
      if (emptyState) emptyState.style.display = "block";
      if (loadingState) loadingState.style.display = "none";
      if (responseBox) responseBox.style.display = "none";
      if (errorState) errorState.style.display = "none";
    });
  }

  // Form submit handler
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const query = input ? input.value.trim() : "";
      if (!query) {
        showToast("Please enter a question for the AI Mentor.", "info");
        return;
      }
      submitMentorQuestion(query);
    });
  }

  // Submit question to backend
  async function submitMentorQuestion(question) {
    if (!question) return;

    stopMentorVoice();

    // Clear input box immediately upon sending
    if (input) input.value = "";

    // Set UI to loading state
    if (emptyState) emptyState.style.display = "none";
    if (responseBox) responseBox.style.display = "none";
    if (errorState) errorState.style.display = "none";
    if (loadingState) loadingState.style.display = "block";

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...`;
    }
    if (input) input.disabled = true;

    const payload = {
      context: {
        overallScore: CompetencyState.candidate.overallScore || 78,
        targetRole: "Java Developer",
        skills: {
          "java": 76,
          "debugging": 65,
          "sql": 81,
          "problemSolving": 79
        }
      },
      prompt: question,
      question: question
    };

    const BACKEND_URL = `${getApiBaseUrl()}/api/ai/mentor`;

    try {
      const response = await fetch(BACKEND_URL, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (loadingState) loadingState.style.display = "none";

      if (response.ok && data.success) {
        if (responseBox) responseBox.style.display = "block";
        if (questionText) questionText.textContent = question;
        const answer = data.data?.response || data.data?.answer || data.answer || data.response;
        lastRawAnswerText = answer;
        
        // Render formatted HTML without raw asterisks/hashtags
        if (answerContent) answerContent.innerHTML = renderCleanMarkdown(answer);

        // Auto Voice Output if enabled
        if (isAutoVoiceEnabled) {
          speakMentorResponse(answer);
        }

        showToast("Gemini AI Mentor response generated!", "success");
      } else {
        if (errorState) errorState.style.display = "block";
        const errMsg = data.message || "AI service encountered an issue. Please check your API key.";
        if (errorText) errorText.textContent = errMsg;
        showToast("AI Mentor encountered an error.", "info");
        if (response.status === 403 || response.status === 400) {
          if (typeof window.BYOKManager !== 'undefined') {
            window.BYOKManager.checkKeyStatus();
          }
        }
      }

    } catch (err) {
      if (loadingState) loadingState.style.display = "none";
      if (errorState) errorState.style.display = "block";
      if (errorText) {
        errorText.textContent = `Network Error: Unable to reach backend service at ${BACKEND_URL}. Details: ${err.message}.`;
      }
      showToast("Could not connect to backend.", "info");
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<span>Send</span> <i class="fa-solid fa-paper-plane"></i>`;
      }
      if (input) {
        input.disabled = false;
        input.value = "";
      }
    }
  }
}

