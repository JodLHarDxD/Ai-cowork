Run a structured project discovery session. Extract everything needed before a single line of code is written.

Work through these sections in order. Ask each question, wait for the answer, then move to the next. Do NOT dump all questions at once.

---

## SECTION 1 — Vision
1. "What is this project? Describe it like you're pitching it in 2 sentences."
2. "Who is the target user? (B2C customer, B2B client, internal team, etc.)"
3. "Any existing brand name or domain in mind?"

## SECTION 2 — Reference & Style
4. "Give me 2–5 websites you want this to feel like. Paste URLs or names."
5. "Describe the visual mood: minimal / luxury / bold / editorial / playful / corporate / other?"
6. "Any specific colors, fonts, or 'do NOT do this' style rules?"

## SECTION 3 — Scope & Features
7. "Which surfaces do you need? (check all that apply)"
   - Frontend / storefront (public-facing)
   - Backend API
   - Admin panel (manage products, orders, content)
   - Auth / login (customer accounts)
   - Payment gateway (which one — Stripe / Razorpay / other / not needed yet)
   - Email / notifications
   - CMS / blog / editorial content
   - Mobile app (or just responsive web)

8. "What are the 3–5 core user flows? (e.g. browse → add to cart → checkout → confirmation)"

9. "What does 'done' look like for v1? What can be left for v2?"

## SECTION 4 — Stack & Infrastructure
10. "Any stack preferences or constraints? (framework, DB, hosting, monorepo vs separate repos)"
11. "CI/CD needed from day one, or post-launch?"
12. "Expected scale: hobby / small business / high-traffic launch? Affects infra decisions."
13. "Do you need multi-environment setup? (dev / staging / prod)"

## SECTION 5 — Pre-Build Research Phase
14. "Before coding starts, do you want agents to run a research phase first?"
    - Collect component references / libraries to use
    - Audit competitor sites
    - Define token/design system before UI work
    - Map API contracts before frontend work
    "Yes / No / Which ones?"

## SECTION 6 — Constraints & Timeline
15. "Any hard constraints? (budget, tech you cannot use, deadlines, team size)"
16. "Are you building this solo or with others? Any non-AI team members?"

---

## After all answers collected:

Generate a structured project brief in this format:

```
# PROJECT BRIEF — <ProjectName>

## Vision
<2-3 sentences>

## Target User
<who, what they need>

## Style Direction
References: <list>
Mood: <keywords>
Rules: <do/don't list>

## Surfaces & Features
<bullet list of confirmed surfaces>
Core flows:
1. ...
2. ...
V1 scope: <what ships>
V2 deferred: <what waits>

## Stack
Frontend: <framework>
Backend: <framework/runtime>
DB: <choice>
Auth: <choice>
Payments: <choice or N/A>
Hosting: <choice>
CI/CD: <day-one / post-launch>
Environments: <dev/staging/prod or simpler>

## Pre-Build Research Tasks
<list of research tasks to run before build, or "None">

## Constraints
<hard limits, deadlines, team>
```

Then say:
"This brief is ready. Next steps:
1. Copy this to Gemini — ask it to poke holes, add what's missing, sharpen the stack choices
2. Bring Gemini's additions back here — I'll merge both into the final brain entry
3. Once merged: save to D:\.agents\projects\<name>.md and run jodl brief to start the build"
