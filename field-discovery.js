const discoveryQuestions = [
  {
    topic: "How you like to think",
    text: "Which kind of problem sounds most satisfying to solve?",
    options: [
      { label: "Building user interfaces, DOM interactions, and responsive layouts", tags: ["frontend"] },
      { label: "Designing APIs, server routing, and database integrations", tags: ["backend"] },
      { label: "Analyzing numbers, querying data, and uncovering business metrics", tags: ["data"] }
    ]
  },
  {
    topic: "Your curiosity",
    text: "What would you most enjoy investigating?",
    options: [
      { label: "Algorithmic efficiency, time complexity, and data structures", tags: ["core_cs"] },
      { label: "Writing clean syntax functions, loops, and handling logic errors", tags: ["programming"] },
      { label: "How web applications render and interact with users in the browser", tags: ["frontend"] }
    ]
  },
  {
    topic: "Numbers and data",
    text: "How do you feel about working with numbers and data?",
    options: [
      { label: "I love writing SQL queries, analyzing datasets, and building metrics", tags: ["data"] },
      { label: "I prefer working on mathematical logic and core computer science problems", tags: ["core_cs"] },
      { label: "I prefer building server APIs and application backend logic", tags: ["backend"] }
    ]
  },
  {
    topic: "Building things",
    text: "What would you rather make on a free afternoon?",
    options: [
      { label: "A Python automation script or command-line tool", tags: ["programming"] },
      { label: "An interactive web component or modern frontend dashboard", tags: ["frontend"] },
      { label: "A scalable REST API service or database schema", tags: ["backend"] }
    ]
  },
  {
    topic: "Working with code",
    text: "Which area sounds most exciting to practice right now?",
    options: [
      { label: "Core programming syntax, functions, and code debugging", tags: ["programming"] },
      { label: "Data structures, tree algorithms, and computational logic", tags: ["core_cs"] },
      { label: "Relational tables, SQL joins, and data analysis queries", tags: ["data"] }
    ]
  },
  {
    topic: "Aptitude in practice",
    text: "When building a software solution, what do you naturally focus on first?",
    options: [
      { label: "The visual presentation, responsive layout, and UI usability", tags: ["frontend"] },
      { label: "Server endpoints, request handling, and backend data flow", tags: ["backend"] },
      { label: "Big-O time complexity, data structures, and optimal algorithms", tags: ["core_cs"] }
    ]
  },
  {
    topic: "Your ideal workday",
    text: "Which project would leave you feeling most accomplished?",
    options: [
      { label: "Writing robust Python code to solve data processing tasks", tags: ["programming"] },
      { label: "Creating clean, responsive web user interfaces", tags: ["frontend"] },
      { label: "Structuring relational databases and analyzing key datasets", tags: ["data"] }
    ]
  },
  {
    topic: "What to explore next",
    text: "What would you most like to demonstrate in your next practical assessment?",
    options: [
      { label: "Building high-performance backend APIs and web servers", tags: ["backend"] },
      { label: "Solving challenging core computer science and logic problems", tags: ["core_cs"] },
      { label: "Mastering practical programming skills and code debugging", tags: ["programming"] }
    ]
  }
];

const discoveryFields = {
  programming: {
    title: "Programming",
    reason: "You are drawn to writing clean functions, solving algorithmic tasks, and mastering practical coding fundamentals.",
    icon: "fa-code",
    filter: "programming"
  },
  data: {
    title: "Data & SQL",
    reason: "You are energized by finding patterns in numbers, writing relational SQL queries, and analyzing datasets.",
    icon: "fa-database",
    filter: "data"
  },
  core_cs: {
    title: "Core CS",
    reason: "You enjoy fundamental computer science principles, data structures, complexity analysis, and logic puzzles.",
    icon: "fa-diagram-project",
    filter: "core_cs"
  },
  backend: {
    title: "Backend",
    reason: "You are fascinated by server routing, REST API architectures, request handling, and backend data flows.",
    icon: "fa-server",
    filter: "backend"
  },
  frontend: {
    title: "Frontend",
    reason: "You enjoy building interactive user interfaces, managing DOM states, CSS layouts, and modern web UX.",
    icon: "fa-desktop",
    filter: "frontend"
  }
};

const discoveryState = {
  currentQuestion: 0,
  selectedAnswers: Array(discoveryQuestions.length).fill(null),
  signals: { programming: 0, data: 0, core_cs: 0, backend: 0, frontend: 0 }
};

const questionText = document.getElementById("questionText");
const questionTopic = document.getElementById("questionTopic");
const answerOptions = document.getElementById("answerOptions");
const questionCount = document.getElementById("questionCount");
const questionPercent = document.getElementById("questionPercent");
const quizProgress = document.getElementById("quizProgress");
const backQuestion = document.getElementById("backQuestion");
const nextQuestion = document.getElementById("nextQuestion");
const quizView = document.getElementById("quizView");
const resultView = document.getElementById("resultView");
const suggestionCards = document.getElementById("suggestionCards");

function renderDiscoveryQuestion() {
  const question = discoveryQuestions[discoveryState.currentQuestion];
  const questionNumber = discoveryState.currentQuestion + 1;
  const percent = Math.round((questionNumber / discoveryQuestions.length) * 100);

  questionTopic.textContent = question.topic;
  questionText.textContent = question.text;
  questionCount.textContent = `Question ${questionNumber} of ${discoveryQuestions.length}`;
  questionPercent.textContent = `${percent}%`;
  quizProgress.style.width = `${percent}%`;
  answerOptions.innerHTML = "";

  question.options.forEach((option, optionIndex) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "discovery-option";
    button.textContent = option.label;
    button.classList.toggle("selected", discoveryState.selectedAnswers[discoveryState.currentQuestion] === optionIndex);
    button.addEventListener("click", () => {
      discoveryState.selectedAnswers[discoveryState.currentQuestion] = optionIndex;
      answerOptions.querySelectorAll(".discovery-option").forEach(item => item.classList.remove("selected"));
      button.classList.add("selected");
      nextQuestion.disabled = false;
    });
    answerOptions.appendChild(button);
  });

  backQuestion.disabled = discoveryState.currentQuestion === 0;
  nextQuestion.disabled = discoveryState.selectedAnswers[discoveryState.currentQuestion] === null;
  nextQuestion.innerHTML = discoveryState.currentQuestion === discoveryQuestions.length - 1 ? "See My Suggestions <i class=\"fa-solid fa-compass\"></i>" : "Next <i class=\"fa-solid fa-arrow-right\"></i>";
}

// getApiBaseUrl is provided globally by config.js

async function fetchActiveCategories() {
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/assessments`);
    if (res.ok) {
      const body = await res.json();
      if (body.success && Array.isArray(body.data)) {
        return new Set(body.data.map(item => (item.category || '').toLowerCase()));
      }
    }
  } catch (e) {}
  return new Set(['programming', 'data & sql', 'data', 'core cs', 'backend', 'frontend']);
}

function fieldHasAssessments(field, activeCategories) {
  if (!field) return false;
  const title = (field.title || '').toLowerCase();
  const filter = (field.filter || '').toLowerCase();
  const categoryName = (field.categoryName || '').toLowerCase();

  return [...activeCategories].some(cat =>
    cat.includes(filter) || cat.includes(title) || (categoryName && cat.includes(categoryName))
  );
}

async function renderDiscoveryResults() {
  discoveryState.signals = { programming: 0, data: 0, core_cs: 0, backend: 0, frontend: 0 };
  if (discoveryFields.communication) {
    discoveryState.signals.communication = 0;
  }

  discoveryState.selectedAnswers.forEach((answerIndex, questionIndex) => {
    if (answerIndex === null) return;
    discoveryQuestions[questionIndex].options[answerIndex].tags.forEach(tag => {
      if (discoveryState.signals[tag] !== undefined) {
        discoveryState.signals[tag] += 1;
      }
    });
  });

  const activeCategories = await fetchActiveCategories();

  const suggestions = Object.entries(discoveryState.signals)
    .sort(([, first], [, second]) => second - first)
    .map(([tag]) => discoveryFields[tag])
    .filter(field => fieldHasAssessments(field, activeCategories))
    .slice(0, 3);

  suggestionCards.innerHTML = suggestions.map(field => `
    <article class="card card-hover-glow discovery-suggestion">
      <div class="discovery-suggestion-icon"><i class="fa-solid ${field.icon}"></i></div>
      <h3>${field.title}</h3>
      <p>${field.reason}</p>
      <a href="assessments.html?field=${field.filter}" class="btn btn-secondary btn-sm">Explore assessments <i class="fa-solid fa-arrow-right"></i></a>
    </article>
  `).join("");

  quizView.hidden = true;
  resultView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

nextQuestion.addEventListener("click", async () => {
  if (discoveryState.selectedAnswers[discoveryState.currentQuestion] === null) return;
  if (discoveryState.currentQuestion === discoveryQuestions.length - 1) {
    await renderDiscoveryResults();
    return;
  }
  discoveryState.currentQuestion += 1;
  renderDiscoveryQuestion();
});

backQuestion.addEventListener("click", () => {
  if (discoveryState.currentQuestion === 0) return;
  discoveryState.currentQuestion -= 1;
  renderDiscoveryQuestion();
});

document.getElementById("retakeQuiz").addEventListener("click", () => {
  discoveryState.currentQuestion = 0;
  discoveryState.selectedAnswers = Array(discoveryQuestions.length).fill(null);
  quizView.hidden = false;
  resultView.hidden = true;
  renderDiscoveryQuestion();
});

renderDiscoveryQuestion();
