import { Router } from 'express';
import { getApplications, addApplication, updateApplication, deleteApplication } from '../db/dataStore.js';
import { buildApplicationsDocx } from '../services/docxExport.js';

const router = Router();

router.get('/',        (req, res) => res.json(getApplications()));
router.post('/',       (req, res) => res.json(addApplication(req.body)));
router.patch('/:id',  (req, res) => res.json(updateApplication(req.params.id, req.body)));
router.delete('/:id', (req, res) => res.json(deleteApplication(req.params.id)));

// ── Export applications as PDF (styled print page) ────────────
router.get('/export/pdf', (req, res) => {
  const apps = getApplications();
  const e = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const statusColor = s => {
    if (['Offer','Accepted'].includes(s)) return '#15803d';
    if (['Interview','Responded'].includes(s)) return '#1d4ed8';
    if (s === 'Applied') return '#7c3aed';
    if (['Rejected','Withdrawn','Skipped'].includes(s)) return '#b91c1c';
    return '#555';
  };
  const rows = apps.map(a => `<tr>
    <td>${e(a.company)}</td><td>${e(a.role)}</td>
    <td><span style="color:${statusColor(a.status)};font-weight:600">${e(a.status)}</span></td>
    <td>${e(a.score || '—')}</td>
    <td>${e(a.dateApplied || a.dateAdded || '—')}</td>
    <td>${e(a.notes || '')}</td>
  </tr>`).join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Applications Tracker</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Calibri',sans-serif;font-size:10pt;color:#111;background:#fff;padding:28px 36px}
  h1{font-size:16pt;font-weight:700;margin-bottom:4px}
  .meta{font-size:9pt;color:#666;margin-bottom:18px}
  table{width:100%;border-collapse:collapse}
  th{background:#f0f0f0;font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:7px 10px;text-align:left;border-bottom:2px solid #ccc}
  td{font-size:10pt;padding:6px 10px;border-bottom:1px solid #e5e5e5;vertical-align:top}
  .export-bar{text-align:center;margin-bottom:20px;padding:10px;background:#f8f8f8;border-radius:6px;font-size:10pt}
  .export-bar button{font-size:10pt;padding:6px 18px;background:#111;color:#fff;border:none;border-radius:4px;cursor:pointer;margin-left:10px}
  @media print{.export-bar{display:none}body{padding:0}}
</style></head><body>
<div class="export-bar">Ready to save as PDF → <button onclick="window.print()">Save as PDF</button></div>
<h1>Applications Tracker</h1>
<div class="meta">Exported ${new Date().toLocaleDateString()} · ${apps.length} application${apps.length !== 1 ? 's' : ''}</div>
<table>
  <thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Score</th><th>Date</th><th>Notes</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px">No applications yet.</td></tr>'}</tbody>
</table></body></html>`);
});

// ── Export applications as DOCX ───────────────────────────────
router.get('/export/docx', async (req, res) => {
  try {
    const apps = getApplications();
    const buf  = await buildApplicationsDocx(apps);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="applications_tracker.docx"');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
