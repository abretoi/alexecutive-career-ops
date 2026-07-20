#!/usr/bin/env node
/**
 * export-tracker.js
 * Reads data/applications.md and writes a CSV to data/exports/
 * Usage: node scripts/export-tracker.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const inputPath  = path.join(ROOT, 'data', 'applications.md');
const outputDir  = path.join(ROOT, 'data', 'exports');
const outputPath = path.join(outputDir, `applications-${today()}.csv`);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseMarkdownTable(md) {
  const lines = md.split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 3) return [];
  const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
  const rows = lines.slice(2).map(line => {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });
  return rows;
}

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape  = v => `"${(v ?? '').replace(/"/g, '""')}"`;
  const csvRows = [
    headers.map(escape).join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(','))
  ];
  return csvRows.join('\n');
}

if (!fs.existsSync(inputPath)) {
  console.error('Error: data/applications.md not found. Run /opus tracker first.');
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const md   = fs.readFileSync(inputPath, 'utf8');
const rows = parseMarkdownTable(md);
const csv  = toCSV(rows);

fs.writeFileSync(outputPath, csv, 'utf8');

console.log(`\n✅ Exported ${rows.length} applications`);
console.log(`   → ${outputPath}\n`);
console.log('To import into Google Sheets:');
console.log('  File → Import → Upload CSV → Separator: Comma\n');
console.log('To open in Excel:');
console.log('  Double-click the CSV file, or use Data → Text to Columns → Comma\n');
