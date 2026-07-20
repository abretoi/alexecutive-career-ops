# Mode: Interview Prep

Triggered by `/opus prep` or "help me prepare for my interview" / "interview prep for [company]".

## Steps

1. **Identify the role** — ask which company/role, or use most recent Applied/Interview entry
2. **Load context**:
   - Evaluation report from `reports/` for that company/role
   - User's `resume.md` and `interview-prep/story-bank.md`
   - `config/profile.yml` for narrative
3. **Research the company** (if not in existing report):
   - Mission, values, recent news, product/service
   - Culture signals from JD and public sources
4. **Generate prep guide**:

   ### A. Role-Specific Behavioral Questions (10)
   - Tailored to archetype and seniority level
   - Format: Q + ideal STAR framing + which story from the bank to use

   ### B. Technical / Domain Questions (5)
   - Specific to the role and industry
   - Common knowledge gaps to review

   ### C. "Tell Me About Yourself" Script
   - 90-second version using user's narrative from profile
   - Opening, experience arc, why this role

   ### D. Questions to Ask the Interviewer (5)
   - Culture / team questions
   - Role-specific strategic questions
   - Shows research (mention something specific about the company)

   ### E. Compensation Negotiation
   - Based on user's target range vs. estimated market
   - Timing: when to bring it up and how to frame it

5. **Save to** `interview-prep/{company-slug}-{role-slug}.md`
6. **Update story bank** — if user shares new stories during prep, add to `interview-prep/story-bank.md`
