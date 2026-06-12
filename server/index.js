import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';

const ALLOWED_COMPANIES = new Set([
  'stripe',
  'doordash',
  'dropbox',
  'squarespace',
  'asana',
]);

// Maps the company key used throughout the app to its actual Greenhouse board token.
const GREENHOUSE_SLUGS = {
  doordash: 'doordashusa',
};

const FIT_ASSESSMENT_SYSTEM_PROMPT = `You are a job fit assessor for a specific candidate. Your job is to evaluate a job posting against this candidate's profile and constraints, and return a structured fit assessment.

CANDIDATE PROFILE

Name: Florence Tang
Current location: Toronto, ON (open to remote or hybrid roles)

Background:
AI practitioner and marketing web leader with 5+ years in web production and marketing operations. Most recently Web Production Lead at Block (Square), leading a team of 12-17 production designers and design technologists managing 10,000+ pages across 8 countries and 11 locales. Drove AI adoption across the team - organized an AI offsite where every team member shipped a project, supported MCP development, partnered with engineering on an AI-driven page builder, and independently built production tools using Claude Code as a primary working mode.

Core strengths:
- AI tool building and workflow automation (Claude Code, MCP development, API integration)
- Marketing operations: web production, CMS (Contentful), GTM execution, cross-functional delivery
- People leadership: managed teams of 5-17, coaching across maturity levels
- Technical fluency: HTML/CSS, Optimizely, Airtable, Jira, Figma plugin development
- AI enablement and team coaching

Selected AI projects shipped independently:
- Figma translation plugin (automates design-to-localization handoff)
- AI-animated portfolio site
- AI-powered project planning tool
- MCP infrastructure support at Block

Industries: Fintech, creative agency (Nike, Ralph Lauren, Converse)

HARD CONSTRAINTS (automatic disqualifiers if not met)

- Compensation: Must meet or exceed $160,000 CAD base. Flag any role with a posted range below this floor.
- Location: Toronto-based. Remote and hybrid roles are acceptable. Fully on-site roles outside Toronto are disqualifying.
- Role type: NOT a fit if the role is primarily: pure SEO, pure content strategy, agency-side account management, or pure brand/campaign management with no operational or technical component.
- Role type: NOT a fit if the role is a software engineering or developer role (e.g. Software Engineer, Backend/Frontend/Full-Stack Engineer, Mobile Engineer, Data Engineer, ML Engineer, DevOps/SRE, QA/Test Engineer). Florence is not a qualified candidate for these positions, regardless of how well other aspects of the role might align.
- Role type: IS a fit if the role involves: web production, marketing operations, AI tool building, workflow automation, web program management, or individual contributor roles in web creative, production, or AI.

SCORING INSTRUCTIONS

Evaluate the job posting and return a JSON object with exactly this structure:

{
  "score": <integer 0-100>,
  "recommendation": <"Apply" | "Maybe" | "Skip">,
  "summary": <one sentence, plain language, why this role is or isn't a fit>,
  "reasoning": <1-2 short sentences explaining what specifically drove the score - the key factors, scannable at a glance>,
  "breakdown": {
    "skills_match": <integer 0-100>,
    "seniority_match": <integer 0-100>,
    "comp_likely_met": <true | false | "unknown">,
    "location_ok": <true | false>,
    "role_type_fit": <"Strong" | "Partial" | "Poor">
  },
  "green_flags": [<up to 3 specific things from the posting that are strong fits>],
  "red_flags": [<up to 3 specific things from the posting that are concerns or disqualifiers>],
  "one_line_pitch": <one sentence Florence could use to open a cover letter or outreach message for this role>
}

Return only the JSON object. No preamble, no explanation, no markdown formatting.`;

const NEXT_ACTION_SYSTEM_PROMPT = `You are a job search advisor. Given the details of a job application, suggest the single most important next action the candidate should take right now. Return one sentence only, starting with a verb. No preamble.`;

// Bare "United States" with no city/remote info - too ambiguous to auto-include or exclude.
const BARE_COUNTRY_NAMES = new Set(['united states', 'usa', 'us', 'u.s.', 'u.s.a.']);

// Hard location constraint: Toronto-based, or remote within Canada.
// Returns 'eligible', 'ambiguous' (bare country name, needs manual review), or 'excluded'.
function classifyLocation(locationName) {
  if (!locationName) return 'excluded';
  const loc = locationName.toLowerCase().trim();

  if (/\btoronto\b/.test(loc)) return 'eligible';
  if (/\b(canada|ontario)\b/.test(loc)) return 'eligible';

  if (/\bremote\b/.test(loc)) {
    // Strip "remote" and common filler words/punctuation. If anything
    // meaningful remains, it's a remote role tied to another place - exclude.
    const stripped = loc
      .replace(/\bremote\b/g, ' ')
      .replace(/\b(select locations|locations|only|fully|first|in|the|north america|na|or)\b/g, ' ')
      .replace(/[()\-,;:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return stripped === '' ? 'eligible' : 'excluded';
  }

  if (BARE_COUNTRY_NAMES.has(loc)) return 'ambiguous';

  return 'excluded';
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Ashby job pages are client-rendered, so the raw HTML has no description.
// Their public job board API exposes full posting content by org slug + job id.
async function fetchAshbyPosting(url) {
  const match = new URL(url).pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!match) return null;

  const [, orgSlug, jobId] = match;
  const boardRes = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${orgSlug}?includeCompensation=true`
  );
  if (!boardRes.ok) return null;

  const board = await boardRes.json();
  const job = (board.jobs || []).find((j) => j.id === jobId);
  if (!job) return null;

  return {
    jobTitle: job.title,
    jobDescription: htmlToText(job.descriptionHtml || '').slice(0, 15000),
  };
}

function stripJsonFormatting(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
}

app.get('/api/jobs/:company', async (req, res) => {
  const { company } = req.params;

  if (!ALLOWED_COMPANIES.has(company)) {
    return res.status(400).json({ error: `Unsupported company: ${company}` });
  }

  try {
    const slug = GREENHOUSE_SLUGS[company] || company;
    const response = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
    );

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `Greenhouse API returned ${response.status} for ${company}` });
    }

    const data = await response.json();
    const jobs = (data.jobs || [])
      .map((job) => ({ ...job, locationStatus: classifyLocation(job.location?.name) }))
      .filter((job) => job.locationStatus !== 'excluded');
    res.json(jobs);
  } catch (err) {
    console.error(`Error fetching jobs for ${company}:`, err);
    res.status(500).json({ error: 'Failed to fetch jobs from Greenhouse' });
  }
});

app.post('/api/assess', async (req, res) => {
  const { jobTitle, jobDescription, company } = req.body;

  if (!jobTitle || !jobDescription) {
    return res.status(400).json({ error: 'jobTitle and jobDescription are required' });
  }

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: FIT_ASSESSMENT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Company: ${company}\nJob Title: ${jobTitle}\n\nJob Description:\n${jobDescription}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const cleaned = stripJsonFormatting(textBlock?.text || '{}');
    const assessment = JSON.parse(cleaned);

    res.json(assessment);
  } catch (err) {
    console.error('Error assessing job fit:', err);
    res.status(500).json({ error: 'Failed to assess job fit' });
  }
});

app.post('/api/assess-url', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    let jobTitle;
    let jobDescription;

    const ashbyPosting = new URL(url).hostname === 'jobs.ashbyhq.com' ? await fetchAshbyPosting(url) : null;

    if (ashbyPosting) {
      jobTitle = ashbyPosting.jobTitle;
      jobDescription = ashbyPosting.jobDescription;
    } else {
      const pageRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobSearchDashboard/1.0)' },
      });

      if (!pageRes.ok) {
        return res.status(pageRes.status).json({ error: `Failed to fetch URL (${pageRes.status})` });
      }

      const html = await pageRes.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      jobTitle = htmlToText(h1Match?.[1] || titleMatch?.[1] || 'Untitled role');
      jobDescription = htmlToText(html).slice(0, 15000);
    }

    let company = 'manual';
    try {
      company = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      // keep default
    }

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: FIT_ASSESSMENT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Company: ${company}\nJob Title: ${jobTitle}\n\nJob Description:\n${jobDescription}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    const cleaned = stripJsonFormatting(textBlock?.text || '{}');
    const assessment = JSON.parse(cleaned);

    res.json({ jobTitle, company, url, assessment });
  } catch (err) {
    console.error('Error assessing job from URL:', err);
    res.status(500).json({ error: 'Failed to assess job from URL' });
  }
});

app.post('/api/next-action', async (req, res) => {
  const { company, role, status, notes } = req.body;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: NEXT_ACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Company: ${company}\nRole: ${role}\nStatus: ${status}\nNotes: ${notes}`,
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    res.json({ nextAction: (textBlock?.text || '').trim() });
  } catch (err) {
    console.error('Error generating next action:', err);
    res.status(500).json({ error: 'Failed to generate next action' });
  }
});

const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(CLIENT_DIST));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
