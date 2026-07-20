# Mode: Tracker

Triggered by `/opus tracker` or "show my applications" / "what's my pipeline status".

## Steps

1. **Read** `data/applications.md`
2. **Compute stats**:
   - Total tracked, by status
   - Avg score across all evaluated roles
   - Response rate (Responded + Interview + Offer / Applied)
   - Interview conversion rate (Interview / Responded)
   - Offer rate (Offer / Interview)
3. **Identify action items**:
   - Applications with no response > 7 days old → suggest follow-up
   - Interviews scheduled → flag upcoming dates
   - Offers pending response → flag
4. **Present dashboard view** in chat:

```
## Application Tracker

**Total:** N | **Applied:** N | **Interviews:** N | **Offers:** N

Pipeline:
  Evaluated  → N
  Resume Ready → N  
  Applied    → N
  Responded  → N
  Interview  → N
  Offer      → N

Avg Match Score: X.X / 5.0
Response Rate: X%
Interview Rate: X%

──────────────────────────────────────────────
ACTION ITEMS
⚠️ [Company] — [Role]: Applied [N] days ago, no response. Consider following up.
📅 [Company] — Interview on [Date] at [Time]
──────────────────────────────────────────────

Recent Applications:
[formatted table]
```

5. **Update statuses** — if user says "update [company] status to Interview": update `data/applications.md`
6. **Log interview dates** — if user mentions interview scheduled: add date to notes column
