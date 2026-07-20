/**
 * docxExport.js — Generates .docx files for resume, cover letter, and applications
 * Uses the `docx` npm package (pure JS, no native deps).
 */
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType,
} from 'docx';

// ── Helpers ───────────────────────────────────────────────────

function str(v) { return String(v || ''); }

function heading(text, level = HeadingLevel.HEADING_2) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 200, after: 80 },
    border: {
      bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 4 },
    },
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text: str(text), size: 22, font: 'Georgia', ...opts })],
    spacing: { after: 80 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text: `• ${str(text)}`, size: 22, font: 'Georgia' })],
    indent: { left: 360 },
    spacing: { after: 40 },
  });
}

// ── Resume ────────────────────────────────────────────────────

export async function buildResumeDocx(r) {
  const sections = [];

  // Name
  sections.push(new Paragraph({
    children: [new TextRun({ text: str(r.name), bold: true, size: 36, font: 'Georgia' })],
    alignment: AlignmentType.LEFT,
    spacing: { after: 60 },
  }));

  // Contact line
  const contactParts = [r.email, r.phone, r.location, r.linkedin].filter(Boolean).map(str);
  if (contactParts.length) {
    sections.push(new Paragraph({
      children: [new TextRun({ text: contactParts.join('  ·  '), size: 20, color: '555555', font: 'Calibri' })],
      spacing: { after: 200 },
    }));
  }

  // Summary
  if (r.summary) {
    sections.push(heading('Summary'));
    sections.push(body(r.summary));
  }

  // Experience
  if (r.experience?.length) {
    sections.push(heading('Experience'));
    for (const ex of r.experience) {
      sections.push(new Paragraph({
        children: [
          new TextRun({ text: str(ex.title), bold: true, size: 24, font: 'Georgia' }),
          new TextRun({ text: `  at  `, size: 22, font: 'Georgia', color: '666666' }),
          new TextRun({ text: str(ex.company), bold: true, size: 24, font: 'Georgia' }),
        ],
        spacing: { before: 160, after: 40 },
      }));
      if (ex.dates) {
        sections.push(new Paragraph({
          children: [new TextRun({ text: str(ex.dates), size: 20, color: '666666', font: 'Calibri', italics: true })],
          spacing: { after: 60 },
        }));
      }
      for (const b of (ex.bullets || [])) sections.push(bullet(b));
    }
  }

  // Skills
  if (r.skills?.length) {
    sections.push(heading('Skills'));
    sections.push(body(r.skills.join('  ·  ')));
  }

  // Education
  if (r.education?.length) {
    sections.push(heading('Education'));
    for (const ed of r.education) {
      sections.push(body(`${str(ed.degree)} — ${str(ed.school)}${ed.year ? ` (${ed.year})` : ''}`));
    }
  }

  // Certifications
  if (r.certifications?.length) {
    sections.push(heading('Certifications'));
    for (const c of r.certifications) {
      const text = typeof c === 'string' ? c : `${str(c.name)}${c.issuer ? ` — ${c.issuer}` : ''}`;
      sections.push(body(text));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Georgia', size: 22 } },
      },
      paragraphStyles: [
        {
          id: 'Heading2',
          name: 'Heading 2',
          run: { bold: true, size: 22, color: '333333', font: 'Calibri' },
        },
      ],
    },
    sections: [{ properties: {}, children: sections }],
  });

  return Packer.toBuffer(doc);
}

// ── Cover Letter ──────────────────────────────────────────────

export async function buildCoverLetterDocx(text) {
  const paragraphs = str(text).split(/\n{2,}/).map(para =>
    new Paragraph({
      children: [new TextRun({ text: para.replace(/\n/g, ' '), size: 24, font: 'Georgia' })],
      spacing: { after: 200 },
      alignment: AlignmentType.LEFT,
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  return Packer.toBuffer(doc);
}

// ── Applications ──────────────────────────────────────────────

export async function buildApplicationsDocx(apps) {
  const rows = [
    new TableRow({
      tableHeader: true,
      children: ['Company', 'Role', 'Status', 'Score', 'Date', 'Notes'].map(label =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: label, bold: true, size: 20, font: 'Calibri' })],
          })],
          shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' },
        })
      ),
    }),
    ...apps.map(a => new TableRow({
      children: [
        str(a.company), str(a.role), str(a.status),
        str(a.score || '—'), str(a.dateApplied || a.dateAdded || '—'), str(a.notes || ''),
      ].map(text => new TableCell({
        children: [new Paragraph({
          children: [new TextRun({ text, size: 20, font: 'Calibri' })],
        })],
      })),
    })),
  ];

  const table = new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'Applications Tracker', bold: true, size: 32, font: 'Calibri' })],
          spacing: { after: 300 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `Exported ${new Date().toLocaleDateString()}`, size: 20, color: '888888', font: 'Calibri' })],
          spacing: { after: 400 },
        }),
        table,
      ],
    }],
  });

  return Packer.toBuffer(doc);
}
