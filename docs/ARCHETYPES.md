# Industry Archetypes — Evaluation Lenses

Alexecutive Career Ops supports 15 industry archetypes. When evaluating a job, Claude detects the primary archetype from the job description and applies the matching evaluation lens.

## Detection Algorithm

1. Scan JD for keyword signals (see table below)
2. Weight by position: title = 3x, requirements = 2x, description = 1x
3. Select highest-scoring archetype as PRIMARY
4. If second-highest is within 50% of primary, note as SECONDARY
5. Apply primary lens with secondary as context

## Archetype Keywords

| Archetype | Detection Signals |
|---|---|
| Technology/Engineering | software, developer, engineer, API, cloud, DevOps, ML, AI, full stack, backend, frontend, data science |
| Finance/Accounting | CPA, CFA, audit, compliance, risk, financial analyst, controller, banking, fintech, treasury, tax, FP&A |
| Healthcare/Medical | RN, MD, clinical, patient, HIPAA, EMR, nursing, therapy, pharmaceutical, medical device, radiology |
| Legal/Compliance | JD, bar admission, litigation, contract, paralegal, regulatory, counsel, compliance officer, IP, patent |
| Creative/Marketing | designer, copywriter, content, brand, UX, SEO, social media, art director, creative director, campaign |
| Operations/Supply Chain | logistics, warehouse, procurement, supply chain, inventory, fleet, distribution, operations manager |
| Sales/Business Dev | quota, revenue, pipeline, account executive, BDR, SDR, territory, commission, enterprise sales |
| Education/Training | teacher, professor, curriculum, instructional, K-12, higher ed, training specialist, academic |
| Executive/Leadership | CEO, COO, CFO, VP, SVP, director, P&L, board, strategy, transformation, C-suite, general manager |
| Trades/Skilled Labor | electrician, plumber, HVAC, welder, machinist, carpenter, journeyman, apprentice, CDL, mechanic |
| Customer Success | customer success, account manager, implementation, onboarding, retention, NPS, CSAT, support engineer |
| People/HR | recruiter, talent acquisition, HRBP, people operations, benefits, compensation, SHRM, PHR, DEI |
| Government/Nonprofit | GS-level, clearance, public policy, grant, program officer, civic, federal, state, municipal, NGO |
| Scientific/R&D | PhD, research, lab, publications, principal investigator, biotech, chemistry, clinical trials |
| Non-Software Engineering | PE, civil, mechanical, structural, chemical engineer, CAD, FEA, project engineer, EIT, construction |

## Evaluation Lenses

### Technology/Engineering
- **Focus:** Skills over titles. Specific tech stack matters.
- **Key signals:** Language/framework match, system scale, architecture scope
- **Weight shift:** Skills/portfolio +5%, Seniority -5%
- **Resume tip:** Lead with tech stack. Quantify system scale (users, requests, uptime).

### Finance/Accounting
- **Focus:** Credentials + regulatory knowledge (CPA, CFA, Series licenses)
- **Key signals:** Required certifications, regulatory domain (SEC, SOX), ERP proficiency
- **Weight shift:** Credentials +10%, Location -5%
- **Resume tip:** Certifications near top. Dollar amounts managed. Compliance outcomes.

### Healthcare/Medical
- **Focus:** Active license in required state is non-negotiable (PASS/FAIL)
- **Key signals:** License status, specific clinical experience, EMR proficiency
- **Weight shift:** Credentials are PASS/FAIL — cap score at 2.0 if missing required license
- **Resume tip:** License numbers and states. Patient population. Clinical volume.

### Legal/Compliance
- **Focus:** Bar admission in required jurisdiction (PASS/FAIL)
- **Key signals:** Bar status, practice area depth, billable hours expectations
- **Weight shift:** Credentials are PASS/FAIL
- **Resume tip:** Bar admissions listed first. Deal/case values. Practice areas.

### Creative/Marketing
- **Focus:** Portfolio > resume. Demonstrated creative work is the primary signal.
- **Key signals:** Portfolio relevance, tool proficiency, campaign results
- **Weight shift:** Skills/portfolio +15%, Credentials -10%
- **Resume tip:** Link to portfolio. Lead with campaign results (impressions, conversion, revenue).

### Operations/Supply Chain
- **Focus:** Scale and complexity of operations managed
- **Key signals:** Facility/fleet/inventory scale, ERP experience, Six Sigma/Lean certs
- **Weight shift:** Domain +5%, Skills -5%
- **Resume tip:** Quantify everything: units, cost saved, efficiency gains, headcount.

### Sales/Business Development
- **Focus:** Numbers. Quota attainment is the primary signal.
- **Key signals:** Quota attainment %, deal size, sales cycle, tech stack
- **Weight shift:** Hard requirements reframed as "track record"
- **Resume tip:** Quota attainment %. Deal sizes. New logos. Revenue generated. President's Club.

### Education/Training
- **Focus:** Credentials + subject matter match
- **Key signals:** Teaching license/certification, subject area, grade level experience
- **Weight shift:** Credentials +5%, Domain +5%
- **Resume tip:** Certification details. Student outcomes. Curriculum developed.

### Executive/Leadership
- **Focus:** Scope, P&L ownership, transformation narrative
- **Key signals:** Revenue/budget scope, team size, board experience, transformation results
- **Weight shift:** Seniority +10%, Domain +5%, Skills -15%
- **Resume tip:** P&L numbers. Transformation before/after. Board roles. Team scaling.

### Trades/Skilled Labor
- **Focus:** Certifications, licenses, hands-on experience (PASS/FAIL on required certs)
- **Key signals:** Journeyman/master license, CDL class, safety record
- **Weight shift:** Credentials are PASS/FAIL
- **Resume tip:** All certifications with numbers/dates. Equipment list. Safety record.

### Customer Success/Support
- **Focus:** Retention metrics + product/domain knowledge
- **Key signals:** Retention/churn rates, book of business size, implementation experience
- **Weight shift:** Domain +5%, Skills +5%, Seniority -5%
- **Resume tip:** Retention rates. NPS/CSAT. Revenue retained/expanded. Account count.

### People/HR
- **Focus:** SHRM/PHR certifications + functional specialization
- **Key signals:** HR function match, certification status, HRIS proficiency
- **Weight shift:** Credentials +5%, Domain +5%
- **Resume tip:** Certifications first. Headcount supported. Programs launched. Retention metrics.

### Government/Nonprofit
- **Focus:** Security clearance + domain expertise + mission alignment
- **Key signals:** Clearance level, GS-level alignment, grant management
- **Weight shift:** Credentials +5%, Domain +10%, Compensation -10%
- **Resume tip:** Clearance level and status. Grant amounts managed. Policy areas.

### Scientific/R&D
- **Focus:** Education (PhD often required) + publications + domain expertise
- **Key signals:** Degree level, publication record, specific techniques, grant funding
- **Weight shift:** Hard requirements +5%, Credentials +5%
- **Resume tip:** Publication count and impact. Grants won. Techniques. Patents.

### Non-Software Engineering
- **Focus:** PE license + project scale + domain certifications
- **Key signals:** PE/EIT status, engineering discipline match, CAD/analysis tools
- **Weight shift:** Credentials +10%, Skills +5%, Seniority -10%
- **Resume tip:** PE/EIT status with state. Project values and scale. Standards worked to.

---

## Scoring Dimensions (Base Weights)

| Dimension | Weight | What It Measures |
|---|---|---|
| Hard requirement coverage | 30% | % of required qualifications matched |
| Seniority alignment | 15% | Your level vs. the role's level |
| Domain/industry match | 10% | Industry experience relevance |
| Compensation alignment | 10% | Your target vs. stated/estimated range |
| Location/remote fit | 10% | Geographic/work arrangement match |
| Career trajectory fit | 5% | Does this role make sense as your next step? |
| Credentials/licenses | 10% | Required certifications, degrees, clearances |
| Skills/portfolio | 10% | Specific skills, tools, or demonstrated work |

Archetype-specific weight adjustments are applied on top of these base weights.
