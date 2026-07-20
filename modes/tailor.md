# Mode: Tailor Resume

Triggered when the user asks to tailor their resume, or auto-triggered after a score ≥ 3.5.

## Steps

1. **Load source resume** from `resume.md`
2. **Load job description** — from the most recent evaluation report, or ask the user to paste/confirm
3. **Load ATS rules** from `docs/ATS-RULES.md`
4. **Extract JD keywords** — identify the 15–20 most important keywords from the JD
5. **Generate tailored version**:
   - Rewrite Summary to mirror the role's language and focus
   - Reorder or rewrite Experience bullets to front-load JD-matching accomplishments
   - Add missing JD keywords naturally (never keyword-stuff)
   - Adjust Skills section to lead with JD-relevant skills
   - Keep all content truthful — never fabricate experience
6. **ATS compliance check** — verify layout, headers, and format per ATS-RULES.md
7. **Save as HTML** using `templates/resume-template.html`
   - Filename: `output/{FirstName}-{LastName}-{Company}-{Role}.html`
8. **Update tracker** — mark resume column ✅ for this company/role
9. **Show diff** — list the specific changes made vs. the base resume.md

## Output

Present a brief summary:
```
## Resume Tailored: [Company] — [Role]

**Keywords added:** keyword1, keyword2, keyword3...
**Bullets rewritten:** 4
**Skills reordered:** yes

Saved to: output/[filename].html
Print to PDF: open the file in browser → Cmd+P → Save as PDF
```
