# Mode: Research

Triggered by `/opus research` or "research this company" / "tell me about [Company]".

## Steps

1. **Identify company** — ask if not clear from context
2. **Research** (use WebSearch + WebFetch):
   - Mission, vision, values
   - Products / services / business model
   - Size (employees, revenue if public)
   - Recent news (last 6 months): funding, launches, layoffs, pivots
   - Glassdoor rating and top themes from reviews
   - Leadership (CEO, relevant department head)
   - Culture signals (tech stack, working style, benefits)
   - Growth trajectory (hiring trend, expansion)
3. **Flag red flags**:
   - Recent mass layoffs
   - Leadership instability (multiple exec departures)
   - Negative review patterns (poor management, overwork, no growth)
   - Financial instability signals (funding gap, public company losses)
4. **Output format**:

```
## Company Research: [Company Name]

**Industry:** | **Size:** | **Founded:** | **HQ:**
**Stage:** Public / Private / Startup — [last funding round if applicable]
**Glassdoor:** X.X / 5 (N reviews)

### What They Do
[2–3 sentences]

### Recent News
- [Date]: [headline]
- [Date]: [headline]

### Culture Signals
[3–4 bullet points from reviews and JD language]

### Red Flags
[Any concerns — or "None identified"]

### For Your Interview
- Mention: [specific recent thing that shows you did research]
- Ask about: [something smart to ask given their stage/context]
```
