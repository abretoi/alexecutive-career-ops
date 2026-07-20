import { Router } from 'express';
import { getApplications } from '../db/dataStore.js';

const router = Router();

router.get('/csv', (req, res) => {
  const apps = getApplications();
  const headers = ['#','Date Applied','Company','Role','Industry','Score','Status','Resume','Notes','Job URL'];
  const rows = apps.map(a => [
    a.num, a.dateApplied || a.dateAdded, a.company, a.role,
    a.archetype || '', a.score || '', a.status || 'Evaluated',
    a.hasResume ? 'Yes' : 'No', a.notes || '', a.url || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const date = new Date().toISOString().slice(0,10);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="alexecutive-applications-${date}.csv"`);
  res.send(csv);
});

export default router;
