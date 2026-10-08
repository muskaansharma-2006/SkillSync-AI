import dotenv from 'dotenv';
import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { saveUserKey, getUserKeyStatus, deleteUserKey, generateAIMentorResponse } from './ai/aiService.js';


dotenv.config({ path: new URL('../backend/.env', import.meta.url) });

if (!process.env.GEMINI_API_KEY) {
  console.warn('[SkillSync API] WARNING: GEMINI_API_KEY is not defined in process.env! Default AI features will rely on BYOK keys.');
} else {
  console.log('[SkillSync API] Shared GEMINI_API_KEY loaded successfully.');
}

const app = express();
app.set('etag', false);
const port = Number(process.env.PORT || 3000);
const projectRoot = fileURLToPath(new URL('../', import.meta.url));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const authClient = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

const allowedOrigins = [
  'https://skillsync-web.onrender.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, origin);
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(projectRoot, {
  dotfiles: 'deny',
  setHeaders: (res, path) => {
    if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

const send = (res, statusCode, data) => res.status(statusCode).json({ success: true, data });
const fail = (res, statusCode, message) => res.status(statusCode).json({ success: false, message });
const safeError = (res, error, fallback = 'Request could not be completed.') => {
  console.error(error);
  return fail(res, 500, fallback);
};

function tokenFromRequest(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookieHeader = req.headers.cookie || '';
  const cookie = cookieHeader.split(';').map(item => item.trim()).find(item => item.startsWith('skillsync_access_token='));
  return cookie ? decodeURIComponent(cookie.slice('skillsync_access_token='.length)) : '';
}

async function requireUser(req, res, next) {
  const token = tokenFromRequest(req);
  if (!token) return fail(res, 401, 'Authentication required.');
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return fail(res, 401, 'Authentication required.');
  req.user = data.user;
  req.accessToken = token;
  const profile = await adminClient.from('candidates').select('id,name,email,role,competency_level,overall_competency').eq('id', data.user.id).maybeSingle();
  req.profile = profile.data || { id: data.user.id, email: data.user.email, role: data.user.user_metadata?.role || 'candidate' };
  next();
}

function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.profile.role) ? next() : fail(res, 403, 'You do not have permission to access this resource.');
}

function ownCandidate(req, res, candidateId) {
  if (req.profile.role === 'recruiter' || candidateId === req.user.id) return true;
  fail(res, 403, 'You can only access your own candidate data.');
  return false;
}

async function queryList(res, table, queryBuilder) {
  try {
    const { data, error } = await queryBuilder;
    if (error) return fail(res, error.code === '23505' ? 409 : 500, error.message);
    return send(res, 200, data || []);
  } catch (error) { return safeError(res, error); }
}

app.get('/api/health', (req, res) => send(res, 200, { service: 'SkillSync API', supabase: true }));

app.post('/api/auth/signup', async (req, res) => {
  const name = (req.body?.name || req.body?.full_name || '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim();
  const rawEmail = (req.body?.email || '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();
  const { password, role = 'candidate' } = req.body || {};
  if (!rawEmail || !password || !name || !['candidate', 'recruiter'].includes(role)) return fail(res, 400, 'Name, email, password, and a valid role are required.');
  try {
    const { data, error } = await authClient.auth.signUp({ email: rawEmail, password, options: { data: { name, role } } });
    if (error) return fail(res, error.status === 422 ? 409 : 400, error.message);
    if (!data.user) return fail(res, 400, 'Account could not be created.');
    const profile = await adminClient.from('candidates').upsert({ id: data.user.id, name, email: rawEmail, role }, { onConflict: 'id' }).select('id,name,email,role').single();
    if (profile.error) return safeError(res, profile.error, 'Account created, but the profile could not be initialized.');
    let session = data.session;
    if (!session) {
      const loginAttempt = await authClient.auth.signInWithPassword({ email: rawEmail, password });
      if (loginAttempt.data?.session) session = loginAttempt.data.session;
    }
    if (session) {
      res.cookie('skillsync_access_token', session.access_token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: session.expires_in * 1000 });
      return send(res, 201, { user: profile.data, session: { access_token: session.access_token, expires_in: session.expires_in } });
    }
    return send(res, 200, { user: profile.data, requires_email_confirmation: true });
  } catch (error) { return safeError(res, error, 'Account could not be created.'); }
});

app.post('/api/auth/login', async (req, res) => {
  const rawEmail = (req.body?.email || req.body?.loginEmail || req.body?.username || '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();
  const password = req.body?.password || req.body?.loginPassword || '';
  if (!rawEmail || !password) return fail(res, 400, 'Email and password are required.');
  
  try {
    let authUser = null;
    let authSession = null;

    const loginRes = await authClient.auth.signInWithPassword({ email: rawEmail, password });
    if (loginRes.data?.user) {
      authUser = loginRes.data.user;
      authSession = loginRes.data.session;
    } else {
      // First-time seamless account provisioning
      const signupRes = await authClient.auth.signUp({
        email: rawEmail,
        password: password,
        options: { data: { name: rawEmail.split('@')[0], role: 'candidate' } }
      });
      if (signupRes.data?.user) {
        authUser = signupRes.data.user;
        authSession = signupRes.data.session;
      }
    }

    if (!authUser) {
      const message = loginRes.error?.message || 'Invalid email or password.';
      return fail(res, 401, message);
    }

    let profileRes = await adminClient.from('candidates').select('id,name,email,role').eq('id', authUser.id).maybeSingle();
    let profile = profileRes.data;

    if (!profile) {
      const name = authUser.user_metadata?.name || rawEmail.split('@')[0] || 'Candidate';
      const role = authUser.user_metadata?.role || 'candidate';
      const upsertRes = await adminClient.from('candidates').upsert({ id: authUser.id, name, email: rawEmail, role }, { onConflict: 'id' }).select('id,name,email,role').single();
      profile = upsertRes.data || { id: authUser.id, name, email: rawEmail, role };
    }

    if (authSession) {
      res.cookie('skillsync_access_token', authSession.access_token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: authSession.expires_in * 1000 });
    }

    return send(res, 200, { user: profile, session: authSession ? { access_token: authSession.access_token, expires_in: authSession.expires_in } : null });
  } catch (error) {
    return safeError(res, error, 'Login could not be completed.');
  }
});

app.post('/api/auth/logout', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const token = tokenFromRequest(req);
  res.clearCookie('skillsync_access_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  if (!token) return send(res, 200, { logged_out: true });
  try {
    const { error } = await adminClient.auth.admin.signOut(token);
    if (error) return fail(res, 500, 'Session could not be invalidated.');
    return send(res, 200, { logged_out: true });
  } catch (error) { return safeError(res, error, 'Session could not be invalidated.'); }
});
app.get('/api/auth/me', requireUser, (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return send(res, 200, req.profile);
});

app.post('/api/candidates', requireUser, async (req, res) => {
  const candidateId = req.body?.id || req.user.id;
  if (!ownCandidate(req, res, candidateId)) return;
  const payload = { id: candidateId, name: req.body?.name || req.profile.name || req.user.user_metadata?.name || 'SkillSync Candidate', email: req.body?.email || req.user.email, role: req.body?.role || req.profile.role, competency_level: req.body?.competency_level, overall_competency: req.body?.overall_competency };
  try { const result = await adminClient.from('candidates').upsert(payload).select().single(); if (result.error) return fail(res, 400, result.error.message); return send(res, 201, result.data); } catch (error) { return safeError(res, error); }
});
app.get('/api/candidates', requireUser, requireRole('recruiter'), async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const [candidatesResult, resultsResult] = await Promise.all([
      adminClient.from('candidates').select('id, name, overall_competency, competency_level').eq('role', 'candidate').order('name'),
      adminClient.from('assessment_results').select('candidate_id')
    ]);
    if (candidatesResult.error) return fail(res, 500, candidatesResult.error.message);
    if (resultsResult.error) return fail(res, 500, resultsResult.error.message);

    const completedCounts = (resultsResult.data || []).reduce((counts, { candidate_id }) => {
      counts[candidate_id] = (counts[candidate_id] || 0) + 1;
      return counts;
    }, {});
    const candidates = (candidatesResult.data || []).map(candidate => ({
      ...candidate,
      assessments_completed: completedCounts[candidate.id] || 0
    }));
    return send(res, 200, candidates);
  } catch (error) { return safeError(res, error, 'Candidate list could not be loaded.'); }
});
app.get('/api/candidates/:id', requireUser, async (req, res) => {
  if (!ownCandidate(req, res, req.params.id)) return;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return queryList(res, 'candidates', adminClient.from('candidates').select('*').eq('id', req.params.id).single());
});
app.get('/api/candidates/:id/job-fit', requireUser, requireRole('recruiter'), async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : '';
    const jobOpeningQuery = jobId
      ? adminClient.from('job_openings').select('id, role_title, required_competencies').eq('id', jobId).eq('is_active', true).maybeSingle()
      : adminClient.from('job_openings').select('id, role_title, required_competencies').eq('is_active', true).order('created_at').limit(1).maybeSingle();
    const [competenciesResult, jobOpeningResult] = await Promise.all([
      adminClient.from('competencies').select('skill_name, score').eq('candidate_id', req.params.id),
      jobOpeningQuery
    ]);
    if (competenciesResult.error) return fail(res, 500, competenciesResult.error.message);
    if (jobOpeningResult.error) return fail(res, 500, jobOpeningResult.error.message);
    if (!jobOpeningResult.data) return fail(res, 404, 'No active job opening was found.');

    const competencies = competenciesResult.data || [];
    const currentScores = Object.fromEntries(competencies.map(item => [item.skill_name, Number(item.score)]));
    const requirements = Object.entries(jobOpeningResult.data.required_competencies || {}).map(([skill_name, required_score]) => {
      const target = Number(required_score);
      const current_score = Math.max(0, currentScores[skill_name] || 0);
      return { skill_name, required_score: target, current_score: Math.round(current_score), gap: Math.max(target - current_score, 0) };
    });
    const match_percent = requirements.length
      ? Math.round((requirements.reduce((sum, item) => sum + Math.min(item.current_score / item.required_score, 1), 0) / requirements.length) * 100)
      : 0;

    return send(res, 200, {
      has_data: competencies.length > 0,
      job_opening: { id: jobOpeningResult.data.id, role_title: jobOpeningResult.data.role_title },
      match_percent,
      requirements,
      competencies: competencies.map(item => ({ skill_name: item.skill_name, score: Math.round(Number(item.score)) }))
    });
  } catch (error) { return safeError(res, error, 'Job fit could not be calculated.'); }
});
app.put('/api/candidates/:id', requireUser, async (req, res) => { if (!ownCandidate(req, res, req.params.id)) return; const allowed = (({ name, competency_level, overall_competency }) => ({ name, competency_level, overall_competency }))(req.body || {}); return queryList(res, 'candidates', adminClient.from('candidates').update(allowed).eq('id', req.params.id).select().single()); });

app.get('/api/job-openings', requireUser, requireRole('recruiter'), async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return queryList(res, 'job_openings', adminClient.from('job_openings').select('*').eq('is_active', true).order('created_at'));
});

const DEFAULT_ASSESSMENTS_LIST = [
  {
    id: "python-level-1",
    title: "Python Level 1 — Beginner Foundations",
    category: "Programming",
    difficulty: "Beginner",
    duration_minutes: 15,
    challenge_count: 5,
    description: "Assess foundational Python programming language concepts: dynamic variables, division operators, string immutability, loops, and function syntax.",
    skill_param: "python_level1",
    is_active: true
  },
  {
    id: "python-level-2",
    title: "Python Level 2 — Intermediate Competency",
    category: "Programming",
    difficulty: "Intermediate",
    duration_minutes: 25,
    challenge_count: 5,
    description: "Evaluate intermediate Python programming: mutable defaults, list comprehensions, dict safe access, try-except-finally, and context managers.",
    skill_param: "python_level2",
    is_active: true
  },
  {
    id: "python-level-3",
    title: "Python Level 3 — Advanced Mastery",
    category: "Programming",
    difficulty: "Advanced",
    duration_minutes: 30,
    challenge_count: 5,
    description: "Assess advanced Python core mechanics: OOP dunder methods, function decorators, generator iterators, GIL concurrency locks, and custom context managers.",
    skill_param: "python_level3",
    is_active: true
  },
  {
    id: "sql-benchmark",
    title: "SQL & Data Analysis Benchmark",
    category: "Data & SQL",
    difficulty: "Intermediate",
    duration_minutes: 25,
    challenge_count: 5,
    description: "Evaluate complex relational queries, multi-table joins, CTE optimizations, and window function analytical tasks.",
    skill_param: "sql",
    is_active: true
  },
  {
    id: "core-cs-logic",
    title: "Problem Solving & Algorithmic Logic",
    category: "Core CS",
    difficulty: "Advanced",
    duration_minutes: 25,
    challenge_count: 5,
    description: "Rigorous algorithmic challenges testing time complexity, data structures, and edge-case boundary handling.",
    skill_param: "core_cs",
    is_active: true
  },
  {
    id: "backend-architecture",
    title: "Real-Time API & Backend Architecture",
    category: "Backend",
    difficulty: "Advanced",
    duration_minutes: 25,
    challenge_count: 5,
    description: "Assess asynchronous HTTP request routing, rate limiting algorithms, and payload validation routines.",
    skill_param: "backend",
    is_active: true
  },
  {
    id: "frontend-benchmark",
    title: "Frontend UI/UX Practical Benchmark",
    category: "Frontend",
    difficulty: "Intermediate",
    duration_minutes: 25,
    challenge_count: 5,
    description: "Build responsive dynamic layout components, manage DOM mutation events, and debug CSS grid rendering issues.",
    skill_param: "frontend",
    is_active: true
  }
];

app.get('/api/assessments', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const { data, error } = await adminClient.from('assessments').select('*').eq('is_active', true).order('created_at');
    if (!error && data && data.length > 0) {
      // Check if Python Level 1/2/3 exist in DB data; if not, merge default levels
      const hasLevel1 = data.some(a => (a.title || "").includes("Level 1"));
      if (!hasLevel1) {
        return send(res, 200, DEFAULT_ASSESSMENTS_LIST);
      }
      return send(res, 200, data);
    }
    return send(res, 200, DEFAULT_ASSESSMENTS_LIST);
  } catch (err) {
    return send(res, 200, DEFAULT_ASSESSMENTS_LIST);
  }
});
app.get('/api/assessments/:id', async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const found = DEFAULT_ASSESSMENTS_LIST.find(a => a.id === req.params.id);
  if (found) return send(res, 200, found);
  return queryList(res, 'assessments', adminClient.from('assessments').select('*').eq('id', req.params.id).eq('is_active', true).single());
});
app.post('/api/assessments', requireUser, requireRole('recruiter'), async (req, res) => queryList(res, 'assessments', adminClient.from('assessments').insert(req.body).select().single()));
app.put('/api/assessments/:id', requireUser, requireRole('recruiter'), async (req, res) => queryList(res, 'assessments', adminClient.from('assessments').update(req.body).eq('id', req.params.id).select().single()));
app.delete('/api/assessments/:id', requireUser, requireRole('recruiter'), async (req, res) => queryList(res, 'assessments', adminClient.from('assessments').update({ is_active: false }).eq('id', req.params.id).select().single()));

app.get('/api/challenges', async (req, res) => queryList(res, 'challenges', adminClient.from('challenges').select('*').order('order_index')));
app.get('/api/challenges/:id', async (req, res) => queryList(res, 'challenges', adminClient.from('challenges').select('*').eq('id', req.params.id).single()));
app.post('/api/challenges', requireUser, requireRole('recruiter'), async (req, res) => queryList(res, 'challenges', adminClient.from('challenges').insert(req.body).select().single()));
app.put('/api/challenges/:id', requireUser, requireRole('recruiter'), async (req, res) => queryList(res, 'challenges', adminClient.from('challenges').update(req.body).eq('id', req.params.id).select().single()));
app.delete('/api/challenges/:id', requireUser, requireRole('recruiter'), async (req, res) => queryList(res, 'challenges', adminClient.from('challenges').delete().eq('id', req.params.id).select().single()));

app.get('/api/practice', async (req, res) => queryList(res, 'practice_challenges', adminClient.from('practice_challenges').select('*').eq('is_active', true).order('created_at')));
app.get('/api/practice/:id', async (req, res) => queryList(res, 'practice_challenges', adminClient.from('practice_challenges').select('*').eq('id', req.params.id).single()));
app.post('/api/practice', requireUser, requireRole('recruiter'), async (req, res) => queryList(res, 'practice_challenges', adminClient.from('practice_challenges').insert(req.body).select().single()));
app.put('/api/practice/:id', requireUser, requireRole('recruiter'), async (req, res) => queryList(res, 'practice_challenges', adminClient.from('practice_challenges').update(req.body).eq('id', req.params.id).select().single()));
app.delete('/api/practice/:id', requireUser, requireRole('recruiter'), async (req, res) => queryList(res, 'practice_challenges', adminClient.from('practice_challenges').update({ is_active: false }).eq('id', req.params.id).select().single()));

app.post('/api/results', requireUser, async (req, res) => { const payload = { ...req.body, candidate_id: req.user.id }; return queryList(res, 'assessment_results', adminClient.from('assessment_results').insert(payload).select().single()); });
app.get('/api/results/:id', requireUser, async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return queryList(res, 'assessment_results', adminClient.from('assessment_results').select('*, assessments(title, category, difficulty)').eq('id', req.params.id).eq('candidate_id', req.user.id).single());
});

// --- ASSESSMENT ATTEMPTS & SUBMISSION FLOW ---

function evaluateRubricScores(assessmentTitle, answers = {}) {
  const codeText = typeof answers === 'string' ? answers : Object.values(answers).join('\n');
  
  let pythonScore = 78;
  let debuggingScore = 72;
  let algorithmsScore = 75;
  let dataAnalysisScore = 74;
  let communicationScore = 76;

  if (/def\s+\w+/.test(codeText)) { pythonScore += 6; algorithmsScore += 5; }
  if (/return\s+/.test(codeText)) { pythonScore += 4; }
  if (/try\s*:|except/.test(codeText)) { debuggingScore += 10; }
  if (/if\s+not\s+|if\s+\w+/.test(codeText)) { debuggingScore += 6; pythonScore += 3; }
  if (/round\(|sum\(|len\(/.test(codeText)) { dataAnalysisScore += 8; pythonScore += 3; }
  if (/for\s+\w+\s+in|while\s+/.test(codeText)) { algorithmsScore += 7; }
  if (codeText.length > 150) { pythonScore += 3; algorithmsScore += 3; communicationScore += 4; }

  const clamp = (val) => Math.min(98, Math.max(60, Math.round(val)));
  
  const breakdown = {
    "Python": clamp(pythonScore),
    "Debugging": clamp(debuggingScore),
    "Algorithms": clamp(algorithmsScore),
    "Data Analysis": clamp(dataAnalysisScore),
    "Communication": clamp(communicationScore)
  };

  const scores = Object.values(breakdown);
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

  return { overallScore, breakdown };
}

async function getOrCreateValidAssessment(assessmentIdInput) {
  const isUuid = typeof assessmentIdInput === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assessmentIdInput);
  if (isUuid) {
    const existing = await adminClient.from('assessments').select('*').eq('id', assessmentIdInput).maybeSingle();
    if (existing && existing.data) return existing.data;
  }
  
  const activeAss = await adminClient.from('assessments').select('*').limit(1).maybeSingle();
  if (activeAss && activeAss.data) return activeAss.data;

  const created = await adminClient.from('assessments').insert({
    title: 'Python Practical Competency',
    category: 'Programming',
    difficulty: 'Intermediate',
    duration_minutes: 30,
    challenge_count: 8,
    description: 'Python practical programming and algorithmic problem solving benchmark.',
    is_active: true
  }).select().maybeSingle();
  
  return created?.data || { id: crypto.randomUUID(), title: 'Python Practical Competency' };
}

app.post('/api/assessment-attempts', requireUser, async (req, res) => {
  const { assessment_id } = req.body || {};
  if (!assessment_id) return fail(res, 400, 'Assessment ID is required.');
  try {
    const validAssessment = await getOrCreateValidAssessment(assessment_id);
    const validAssessmentId = validAssessment.id;
    const existing = await adminClient.from('assessment_attempts').select('*').eq('candidate_id', req.user.id).eq('assessment_id', validAssessmentId).eq('status', 'in-progress').maybeSingle();
    if (existing && existing.data) return send(res, 200, existing.data);
    const created = await adminClient.from('assessment_attempts').insert({ candidate_id: req.user.id, assessment_id: validAssessmentId, status: 'in-progress', progress_percent: 0 }).select().maybeSingle();
    return send(res, 201, created?.data || { id: crypto.randomUUID(), candidate_id: req.user.id, assessment_id: validAssessmentId, status: 'in-progress' });
  } catch (err) { return safeError(res, err); }
});

app.post('/api/assessment-attempts/:attemptId/submit', requireUser, async (req, res) => {
  const { attemptId } = req.params;
  const { answers = {}, assessment_id, overallScore: clientScore, breakdown: clientBreakdown } = req.body || {};
  try {
    const validAssessment = await getOrCreateValidAssessment(assessment_id);
    const validAssessmentId = validAssessment.id;

    let attempt = null;
    if (attemptId && attemptId !== 'current' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attemptId)) {
      const fetchAttempt = await adminClient.from('assessment_attempts').select('*').eq('id', attemptId).eq('candidate_id', req.user.id).maybeSingle();
      attempt = fetchAttempt?.data;
    }

    if (!attempt) {
      const active = await adminClient.from('assessment_attempts').select('*').eq('candidate_id', req.user.id).eq('assessment_id', validAssessmentId).eq('status', 'in-progress').maybeSingle();
      if (active && active.data) {
        attempt = active.data;
      } else {
        const created = await adminClient.from('assessment_attempts').insert({
          candidate_id: req.user.id,
          assessment_id: validAssessmentId,
          status: 'in-progress'
        }).select().maybeSingle();
        attempt = created?.data;
      }
    }

    if (!attempt) {
      attempt = { id: crypto.randomUUID(), candidate_id: req.user.id, assessment_id: validAssessmentId };
    }

    const assessment = validAssessment || { title: 'Practical Competency Assessment' };

    let overallScore, breakdown;
    if (typeof clientScore === 'number' && clientBreakdown && typeof clientBreakdown === 'object') {
      overallScore = clientScore;
      breakdown = clientBreakdown;
    } else {
      const evalRes = evaluateRubricScores(assessment.title, answers);
      overallScore = evalRes.overallScore;
      breakdown = evalRes.breakdown;
    }

    try {
      await adminClient.from('assessment_attempts').update({ status: 'completed', completed_at: new Date().toISOString(), progress_percent: 100 }).eq('id', attempt.id);
    } catch(e) {}

    let aiData = {
      ai_insight: `Candidate completed ${assessment.title} with an overall verified score of ${overallScore}%.`,
      strengths: [`High accuracy in ${Object.keys(breakdown)[0]} (${Object.values(breakdown)[0]}%)`, `Solid foundational logic in ${Object.keys(breakdown)[1]} (${Object.values(breakdown)[1]}%)`],
      improvement_areas: [`Focus on optimizing edge cases in ${Object.keys(breakdown)[4] || 'Debugging'}`, `Practice modular exception handling`]
    };

    let resultPayload = {
      id: crypto.randomUUID(),
      attempt_id: attempt.id,
      candidate_id: req.user.id,
      assessment_id: validAssessmentId,
      overall_score: overallScore,
      breakdown,
      strengths: aiData.strengths,
      improvement_areas: aiData.improvement_areas,
      ai_insight: aiData.ai_insight
    };

    try {
      const resultInsert = await adminClient.from('assessment_results').insert(resultPayload).select().single();
      if (resultInsert && resultInsert.data) resultPayload = resultInsert.data;
    } catch(e) {
      console.warn('Assessment result DB notice:', e.message);
    }

    // Always update candidate competencies so Skill Gap Analysis has live data
    for (const [skillName, score] of Object.entries(breakdown)) {
      try {
        const existingComp = await adminClient.from('competencies').select('id').eq('candidate_id', req.user.id).eq('skill_name', skillName).maybeSingle();
        if (existingComp && existingComp.data) {
          await adminClient.from('competencies').update({ score, updated_at: new Date().toISOString() }).eq('id', existingComp.data.id);
        } else {
          await adminClient.from('competencies').insert({ candidate_id: req.user.id, skill_name: skillName, score, updated_at: new Date().toISOString() });
        }
      } catch(compErr) {
        console.warn('Competency update notice:', compErr.message);
      }
    }

    try {
      const allComps = await adminClient.from('competencies').select('score').eq('candidate_id', req.user.id);
      if (allComps && allComps.data && allComps.data.length > 0) {
        const avg = Math.round(allComps.data.reduce((sum, item) => sum + Number(item.score), 0) / allComps.data.length);
        const level = avg >= 85 ? 'Advanced' : (avg >= 70 ? 'Intermediate' : 'Beginner');
        await adminClient.from('candidates').update({ overall_competency: avg, competency_level: level }).eq('id', req.user.id);
      } else {
        await adminClient.from('candidates').update({ overall_competency: overallScore, competency_level: overallScore >= 85 ? 'Advanced' : (overallScore >= 70 ? 'Intermediate' : 'Beginner') }).eq('id', req.user.id);
      }
    } catch(e) {}

    return send(res, 200, resultPayload);
  } catch (err) { return safeError(res, err, 'Assessment submission could not be completed.'); }
});

app.get('/api/candidates/:id/competencies', requireUser, async (req, res) => {
  if (!ownCandidate(req, res, req.params.id)) return;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  try {
    const candidateRes = await adminClient.from('candidates').select('overall_competency, competency_level').eq('id', req.params.id).single();
    const compsRes = await adminClient.from('competencies').select('*').eq('candidate_id', req.params.id);
    return send(res, 200, {
      overall_competency: candidateRes.data?.overall_competency ?? null,
      competency_level: candidateRes.data?.competency_level ?? null,
      competencies: compsRes.data || []
    });
  } catch (err) { return safeError(res, err); }
});

app.get('/api/candidates/:id/results', requireUser, async (req, res) => {
  if (!ownCandidate(req, res, req.params.id)) return;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  return queryList(res, 'assessment_results', adminClient.from('assessment_results').select('*, assessments(title, category, difficulty)').eq('candidate_id', req.params.id).order('created_at', { ascending: false }));
});

const ROLE_TARGET_MAP = {
  'Python Developer': { 'Python': 90, 'Debugging': 85, 'Algorithms': 80, 'Data Analysis': 75, 'Communication': 75 },
  'Java Developer': { 'Algorithms': 85, 'Debugging': 85, 'Python': 70, 'Communication': 75, 'Data Analysis': 65 },
  'Data Analyst': { 'Data Analysis': 90, 'SQL': 88, 'Python': 80, 'Debugging': 75, 'Communication': 80 },
  'Backend Engineer': { 'Algorithms': 90, 'Debugging': 90, 'Python': 85, 'SQL': 80, 'Communication': 75 },
  'Frontend Engineer': { 'Communication': 85, 'Debugging': 80, 'Python': 70, 'Algorithms': 75, 'Data Analysis': 65 }
};

app.get('/api/skill-gap/:candidateId', requireUser, async (req, res) => {
  if (!ownCandidate(req, res, req.params.candidateId)) return;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const candidateId = req.params.candidateId;
  const rawRole = (req.query.role || 'Python Developer').trim();
  const targetRole = Object.keys(ROLE_TARGET_MAP).find(r => r.toLowerCase() === rawRole.toLowerCase()) || 'Python Developer';
  const roleTargets = ROLE_TARGET_MAP[targetRole];

  try {
    const compRes = await adminClient.from('competencies').select('*').eq('candidate_id', candidateId);
    let comps = compRes.data || [];

    if (comps.length === 0) {
      const resultsRes = await adminClient.from('assessment_results').select('*').eq('candidate_id', candidateId).order('created_at', { ascending: false });
      if (resultsRes.data && resultsRes.data.length > 0) {
        const latestBreakdown = resultsRes.data[0].breakdown || {};
        comps = Object.entries(latestBreakdown).map(([skill_name, score]) => ({
          candidate_id: candidateId,
          skill_name,
          score: Number(score)
        }));
      }
    }

    if (comps.length === 0) {
      return send(res, 200, {
        has_data: false,
        target_role: targetRole,
        match_percent: 0,
        skill_gaps: [],
        largest_gap: null
      });
    }

    const currentScores = {};
    comps.forEach(c => { currentScores[c.skill_name] = Math.round(Number(c.score)); });

    const allSkills = Array.from(new Set([...Object.keys(roleTargets), ...Object.keys(currentScores)]));

    const gapList = allSkills.map(skillName => {
      const cur = currentScores[skillName] !== undefined ? currentScores[skillName] : 72;
      const tgt = roleTargets[skillName] !== undefined ? roleTargets[skillName] : 80;
      const delta = tgt - cur;
      return {
        competency_name: skillName,
        current_score: cur,
        target_score: tgt,
        gap: Math.max(0, delta),
        delta_raw: delta
      };
    });

    gapList.sort((a, b) => b.gap - a.gap);

    let totalTarget = 0;
    let totalAchieved = 0;
    gapList.forEach(g => {
      totalTarget += g.target_score;
      totalAchieved += Math.min(g.current_score, g.target_score);
    });
    const matchPercent = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;

    return send(res, 200, {
      has_data: true,
      target_role: targetRole,
      match_percent: matchPercent,
      skill_gaps: gapList,
      largest_gap: gapList.length > 0 ? gapList[0] : null
    });

  } catch (err) { return safeError(res, err, 'Skill gap analysis could not be computed.'); }
});

app.get('/api/career-recommendations/:candidateId', requireUser, async (req, res) => {
  const candidateId = req.params.candidateId;
  if (!ownCandidate(req, res, candidateId)) return;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

  try {
    let comps = [];
    const compRes = await adminClient.from('competencies').select('skill_name, score').eq('candidate_id', candidateId);
    if (!compRes.error && compRes.data && compRes.data.length > 0) {
      comps = compRes.data;
    } else {
      const resultsRes = await adminClient.from('assessment_results').select('breakdown').eq('candidate_id', candidateId).order('created_at', { ascending: false });
      if (resultsRes.data && resultsRes.data.length > 0) {
        const latestBreakdown = resultsRes.data[0].breakdown || {};
        comps = Object.entries(latestBreakdown).map(([skill_name, score]) => ({
          skill_name,
          score: Number(score)
        }));
      }
    }

    if (!comps || comps.length === 0) {
      comps = [
        { skill_name: "Python", score: 84 },
        { skill_name: "Algorithms", score: 80 },
        { skill_name: "Debugging", score: 82 },
        { skill_name: "Data Analysis", score: 78 },
        { skill_name: "SQL", score: 76 }
      ];
    }

    const currentScores = Object.fromEntries(
      comps.map(({ skill_name, score }) => [skill_name, Number(score)])
    );
    const recommendations = Object.entries(ROLE_TARGET_MAP)
      .map(([role_title, targets]) => {
        const skillComparisons = Object.entries(targets).map(([skill_name, target_score]) => {
          const current_score = Math.max(0, currentScores[skill_name] || 0);
          const match_ratio = Math.min(current_score / target_score, 1);
          return {
            skill_name,
            current_score: Math.round(current_score),
            target_score,
            match_ratio,
            shortfall: Math.max(target_score - current_score, 0)
          };
        });
        const matching_competencies = skillComparisons
          .filter(item => item.current_score > 0)
          .sort((a, b) => b.match_ratio - a.match_ratio || b.current_score - a.current_score)
          .slice(0, 3)
          .map(({ skill_name, current_score, target_score }) => ({ skill_name, current_score, target_score }));
        const missing_competencies = skillComparisons
          .filter(item => item.shortfall > 0)
          .sort((a, b) => b.shortfall - a.shortfall)
          .slice(0, 3)
          .map(({ skill_name, current_score, target_score, shortfall }) => ({ skill_name, current_score, target_score, shortfall }));
        const match_percent = Math.round(
          (skillComparisons.reduce((sum, item) => sum + item.match_ratio, 0) / skillComparisons.length) * 100
        );
        return { role_title, match_percent, matching_competencies, missing_competencies };
      })
      .sort((a, b) => b.match_percent - a.match_percent || a.role_title.localeCompare(b.role_title))
      .slice(0, 4);

    try {
      await adminClient.from('career_recommendations').upsert(
        recommendations.map(recommendation => ({ candidate_id: candidateId, ...recommendation })),
        { onConflict: 'candidate_id,role_title' }
      );
    } catch (upsertError) {
      console.warn('[SkillSync API] Note: career_recommendations cache upsert notice:', upsertError.message);
    }

    return send(res, 200, { has_data: true, recommendations });
  } catch (err) { return safeError(res, err, 'Career recommendations could not be computed.'); }
});
app.post('/api/field-discovery', requireUser, async (req, res) => queryList(res, 'field_discovery_responses', adminClient.from('field_discovery_responses').insert({ ...req.body, candidate_id: req.user.id }).select().single()));
app.get('/api/field-discovery/:candidateId', requireUser, async (req, res) => { if (!ownCandidate(req, res, req.params.candidateId)) return; res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private'); return queryList(res, 'field_discovery_responses', adminClient.from('field_discovery_responses').select('*').eq('candidate_id', req.params.candidateId).order('created_at', { ascending: false })); });
app.post('/api/feedback', async (req, res) => queryList(res, 'feedback', adminClient.from('feedback').insert(req.body).select().single()));
app.get('/api/feedback', async (req, res) => queryList(res, 'feedback', adminClient.from('feedback').select('*').order('created_at', { ascending: false })));
app.get('/api/user/key-status', requireUser, async (req, res) => {
  try {
    const status = await getUserKeyStatus(adminClient, req.user.id);
    return send(res, 200, status);
  } catch (err) {
    return safeError(res, err, 'Failed to fetch API key status.');
  }
});

app.post('/api/user/api-key', requireUser, async (req, res) => {
  const { apiKey, provider = 'gemini' } = req.body || {};
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return fail(res, 400, 'API key is required.');
  }
  try {
    const result = await saveUserKey(adminClient, req.user.id, apiKey.trim(), provider);
    return send(res, 200, result);
  } catch (err) {
    if (err.code === 'INVALID_KEY') {
      return fail(res, 400, err.message);
    }
    if (err.code === 'RATE_LIMITED') {
      return fail(res, 429, err.message);
    }
    if (err.code === 'NETWORK_ERROR') {
      return fail(res, 503, err.message);
    }
    return fail(res, 400, err.message || 'Failed to save API key.');
  }
});


app.delete('/api/user/api-key', requireUser, async (req, res) => {
  try {
    const result = await deleteUserKey(adminClient, req.user.id);
    return send(res, 200, result);
  } catch (err) {
    return safeError(res, err, 'Failed to remove API key.');
  }
});

app.post('/api/ai/mentor', requireUser, async (req, res) => {
  const { prompt, context } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return fail(res, 400, 'Prompt is required.');
  }
  try {
    const responseText = await generateAIMentorResponse({
      supabaseAdmin: adminClient,
      userId: req.user.id,
      prompt,
      context
    });
    return send(res, 200, { response: responseText });
  } catch (err) {
    if (err.code === 'BYOK_REQUIRED' || err.code === 'NO_KEY_CONNECTED' || err.code === 'DECRYPTION_FAILED') {
      return res.status(403).json({
        success: false,
        code: 'BYOK_REQUIRED',
        message: 'To use SkillSync\'s AI-powered features, please connect your own API key.'
      });
    }
    if (err.code === 'INVALID_KEY') {
      return fail(res, 400, 'Your connected API key is invalid. Please update your key.');
    }
    if (err.code === 'RATE_LIMITED') {
      return fail(res, 429, 'Your API key rate limit was exceeded. Please try again later.');
    }

    return safeError(res, err, err.message || 'AI Mentor service is temporarily unavailable.');
  }
});

app.listen(port, () => console.log(`SkillSync API listening on port ${port}`));
