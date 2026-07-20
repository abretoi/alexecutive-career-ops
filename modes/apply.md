# Mode: Apply (Auto-Fill)

Triggered by `/opus apply` or when the user says "help me apply" / "fill out the application".

## Supported Portals

- LinkedIn Easy Apply
- Workday
- Greenhouse
- Lever
- Ashby
- iCIMS
- Taleo (partial)

## Steps

1. **Confirm the role** — ask which role/company the user wants to apply to, or use the most recently evaluated role
2. **Confirm resume version** — use the tailored version if it exists, otherwise offer to tailor first
3. **Navigate to application** using Playwright
4. **Scan form fields** — identify all required and optional fields
5. **Pre-fill from profile**:
   - Name, email, phone, address: from `config/profile.yml`
   - Work history: from `resume.md`
   - Education: from `resume.md`
   - LinkedIn URL: from `config/profile.yml`
   - Portfolio/website: from `config/profile.yml`
6. **Handle custom questions** — for each essay/open-ended question:
   - Draft an answer using the user's resume and the JD context
   - Present the draft to the user for approval before filling
7. **STOP before final submit** — present a complete summary:
   ```
   ## Ready to Submit: [Company] — [Role]

   Review what I've filled in:
   - Name: [value]
   - Email: [value]
   - [all other fields]
   
   Custom answers:
   - Q: [question] → A: [answer]

   ⚠️ I have NOT clicked Submit. Review everything above, then say "submit" to proceed, or tell me what to change.
   ```
8. **On user confirmation**: click the submit button
9. **Update tracker**: change status from `Resume Ready` → `Applied` with today's date
10. **Save answers**: write all form answers to `data/applications/{company}-{role}-answers.md`

## Critical Rules

- NEVER click Submit/Apply/Send without explicit user confirmation in this chat
- NEVER fabricate experience or credentials in form answers
- Flag any field where the user's profile data is incomplete
- If a question asks for salary expectations: read from `config/profile.yml` and confirm with user before filling
