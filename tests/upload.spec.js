/**
 * TC-01 through TC-12: Resume & Cover Letter upload flows
 *
 * Key behaviour after fixes:
 *   - Uploads ALWAYS return 200 if the file is readable, even with no AI key
 *   - On AI failure: body has { warning: string, _aiParsed: false }
 *   - Wrong field name: 400 JSON (was HTML 500 stack trace)
 *   - File > 10 MB: 413 JSON
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tmpFile(name, content, encoding = 'utf8') {
  const fp = path.join(os.tmpdir(), name);
  fs.writeFileSync(fp, content, encoding);
  return fp;
}

/** Build a minimal valid DOCX (ZIP-based) via Python */
function makeDocx(text) {
  const fp = path.join(os.tmpdir(), 'test-resume.docx');
  execSync(`python3 -c "
import zipfile, io
buf = io.BytesIO()
xml = '''<?xml version=\\"1.0\\" encoding=\\"UTF-8\\" standalone=\\"yes\\"?>
<w:document xmlns:w=\\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\\">
  <w:body><w:p><w:r><w:t>${text.replace(/"/g, '\\\\"')}</w:t></w:r></w:p></w:body>
</w:document>'''
ct = '''<?xml version=\\"1.0\\" encoding=\\"UTF-8\\" standalone=\\"yes\\"?>
<Types xmlns=\\"http://schemas.openxmlformats.org/package/2006/content-types\\">
  <Default Extension=\\"rels\\" ContentType=\\"application/vnd.openxmlformats-package.relationships+xml\\"/>
  <Override PartName=\\"/word/document.xml\\" ContentType=\\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\\"/>
</Types>'''
rels = '''<?xml version=\\"1.0\\" encoding=\\"UTF-8\\" standalone=\\"yes\\"?>
<Relationships xmlns=\\"http://schemas.openxmlformats.org/package/2006/relationships\\">
  <Relationship Id=\\"rId1\\" Type=\\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\\" Target=\\"word/document.xml\\"/>
</Relationships>'''
drels='<?xml version=\\"1.0\\" encoding=\\"UTF-8\\" standalone=\\"yes\\"?><Relationships xmlns=\\"http://schemas.openxmlformats.org/package/2006/relationships\\"></Relationships>'
with zipfile.ZipFile(buf,'w') as z:
    z.writestr('[Content_Types].xml', ct)
    z.writestr('_rels/.rels', rels)
    z.writestr('word/document.xml', xml)
    z.writestr('word/_rels/document.xml.rels', drels)
open('${fp}','wb').write(buf.getvalue())
"`);
  return fp;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// ── TC-01: Resume TXT upload → 200, no error ─────────────────────────────────

test('TC-01 [CRITICAL] resume TXT upload — always succeeds, AI optional', async ({ request }) => {
  // Arrange
  const fp = tmpFile('resume.txt', 'Jane Doe\njane@example.com\nSenior Engineer\nSkills: Python, React');

  // Act
  const res = await request.post('/api/resume/upload', {
    multipart: { resume: { name: 'resume.txt', mimeType: 'text/plain', buffer: fs.readFileSync(fp) } },
  });

  // Assert — 200 regardless of AI availability; may have warning field
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).not.toHaveProperty('error');
  // If AI unavailable, warning field is present and _aiParsed is false
  if (body._aiParsed === false) {
    expect(body.warning).toBeTruthy();
  }
});

// ── TC-02: DOCX upload correct field name ─────────────────────────────────────

test('TC-02 [CRITICAL] resume DOCX upload — correct field "resume" → 200 (regression: was 500)', async ({ request }) => {
  const fp = makeDocx('Jane Doe Senior Engineer');

  const res = await request.post('/api/resume/upload', {
    multipart: { resume: { name: 'resume.docx', mimeType: DOCX_MIME, buffer: fs.readFileSync(fp) } },
  });

  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).not.toHaveProperty('error');
});

// ── TC-03: Wrong field name → 400 JSON (was HTML 500 stack trace) ─────────────

test('TC-03 [CRITICAL] wrong multer field name → 400 JSON not HTML 500', async ({ request }) => {
  const fp = makeDocx('Test content');

  const res = await request.post('/api/resume/upload', {
    multipart: { file: { name: 'resume.docx', mimeType: DOCX_MIME, buffer: fs.readFileSync(fp) } },
  });

  // Must be 400 JSON — not HTML and not 500
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body).toHaveProperty('error');
  expect(typeof body.error).toBe('string');
  expect(body.error).not.toContain('<!DOCTYPE'); // must not be HTML
});

// ── TC-04: No file → 400 ─────────────────────────────────────────────────────

test('TC-04 [HIGH] resume upload with no file → 400 with clear message', async ({ request }) => {
  const res = await request.post('/api/resume/upload', { data: {} });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/no file/i);
});

// ── TC-05: Empty file → 400 ──────────────────────────────────────────────────

test('TC-05 [HIGH] resume upload with empty file → 400 with actionable message', async ({ request }) => {
  const res = await request.post('/api/resume/upload', {
    multipart: { resume: { name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.from('') } },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/empty|unreadable/i);
});

// ── TC-06: Unsupported MIME → 400 ────────────────────────────────────────────

test('TC-06 [HIGH] unsupported file type → 400 with MIME in message', async ({ request }) => {
  const res = await request.post('/api/resume/upload', {
    multipart: { resume: { name: 'virus.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('MZ\x90') } },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toMatch(/unsupported file type/i);
});

// ── TC-07: File > 10 MB → 413 JSON ───────────────────────────────────────────

test('TC-07 [HIGH] file exceeding 10 MB size limit → 413 JSON', async ({ request }) => {
  const big = Buffer.alloc(11 * 1024 * 1024, 'A');
  const res = await request.post('/api/resume/upload', {
    multipart: { resume: { name: 'big.txt', mimeType: 'text/plain', buffer: big } },
  });
  expect(res.status()).toBe(413);
  const body = await res.json();
  expect(body.error).toMatch(/too large/i);
});

// ── TC-08: Paste with text → 200 ─────────────────────────────────────────────

test('TC-08 [HIGH] resume paste with valid text → 200, no error', async ({ request }) => {
  const res = await request.post('/api/resume/paste', {
    data: { text: 'John Doe\njohn@example.com\nSoftware Engineer\nSkills: Python, Node.js\nAcme 2019-2024' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).not.toHaveProperty('error');
  // Email should always be extractable (regex fallback works without AI)
  expect(body.email || body.warning).toBeTruthy();
});

// ── TC-09: Paste empty → 400 ─────────────────────────────────────────────────

test('TC-09 [MEDIUM] resume paste with empty text → 400', async ({ request }) => {
  const res = await request.post('/api/resume/paste', { data: { text: '' } });
  expect(res.status()).toBe(400);
});

// ── TC-10: Cover letter DOCX upload → 200 with extracted text ────────────────

test('TC-10 [HIGH] cover letter DOCX upload — field "file" → 200 with text', async ({ request }) => {
  const fp = makeDocx('Dear Hiring Manager, I am writing to express my interest.');

  const res = await request.post('/api/resume/cover-letter/upload', {
    multipart: { file: { name: 'cl.docx', mimeType: DOCX_MIME, buffer: fs.readFileSync(fp) } },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('text');
  expect(body.text.length).toBeGreaterThan(10);
  expect(body).toHaveProperty('uploadedAt');
});

// ── TC-11: Cover letter paste + retrieve + delete ─────────────────────────────

test('TC-11 [MEDIUM] cover letter paste → GET → DELETE lifecycle', async ({ request }) => {
  const sample = 'Dear Hiring Manager, I am excited about this opportunity.';

  const post = await request.post('/api/resume/cover-letter/paste', { data: { text: sample } });
  expect(post.status()).toBe(200);

  const get = await request.get('/api/resume/cover-letter');
  expect(get.status()).toBe(200);
  expect((await get.json()).text).toBe(sample);

  const del = await request.delete('/api/resume/cover-letter');
  expect(del.status()).toBe(200);

  const getAfter = await request.get('/api/resume/cover-letter');
  expect((await getAfter.json()).text || '').toBe('');
});

// ── TC-12: AI-fallback flag — _aiParsed field present on all upload responses ─

test('TC-12 [MEDIUM] upload response always includes _aiParsed boolean', async ({ request }) => {
  const res = await request.post('/api/resume/paste', {
    data: { text: 'Alex Doe\nalex@example.com\nProduct Manager' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(typeof body._aiParsed).toBe('boolean');
});
