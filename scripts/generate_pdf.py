"""
generate_pdf.py — Alexecutive Career Ops setup guide PDF
Rebuilt with Platypus-only layout: all text in Paragraph/Table cells → guaranteed text wrap.
"""

import os
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, PageBreak
)
from reportlab.platypus.flowables import Flowable
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER

OUT = os.path.join(os.path.dirname(__file__), '..', 'Alexecutive-Career-Ops-Setup-Guide.pdf')

# ── Palette ────────────────────────────────────────────────────────────────────
BG    = colors.HexColor('#000000')
BG1   = colors.HexColor('#0a0a0c')
BG2   = colors.HexColor('#131316')
BG3   = colors.HexColor('#1c1c20')
LINE  = colors.HexColor('#1f1f23')
LINE2 = colors.HexColor('#2a2a2e')
BLUE   = colors.HexColor('#0a84ff')
TEAL   = colors.HexColor('#06b6d4')
GREEN  = colors.HexColor('#30d158')
AMBER  = colors.HexColor('#ff9f0a')
INDIGO = colors.HexColor('#5e5ce6')
ROSE   = colors.HexColor('#ff375f')
TEXT  = colors.HexColor('#f5f5f7')
TEXT2 = colors.HexColor('#a1a1a6')
TEXT3 = colors.HexColor('#6e6e73')
TEXT4 = colors.HexColor('#4a4a4e')
WHITE = colors.HexColor('#ffffff')


# ── Gradient bar (the only custom flowable — purely decorative) ────────────────
class GradientBar(Flowable):
    def __init__(self, width, height=2.5):
        super().__init__()
        self.width  = width
        self.height = height

    def wrap(self, aw, ah):
        return self.width, self.height

    def draw(self):
        from reportlab.lib.colors import linearlyInterpolatedColor
        steps = 160
        for i in range(steps):
            t = i / steps
            c = (linearlyInterpolatedColor(BLUE, TEAL, 0, 1, t * 2)
                 if t < 0.5 else
                 linearlyInterpolatedColor(TEAL, GREEN, 0, 1, (t - 0.5) * 2))
            self.canv.setFillColor(c)
            self.canv.rect(self.width * t, 0, self.width / steps + .5,
                           self.height, fill=1, stroke=0)


# ── Page background + header stripe + footer ──────────────────────────────────
def on_page(canvas, doc):
    W, H = letter
    canvas.saveState()

    # Full black background
    canvas.setFillColor(BG)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)

    # Subtle dark header stripe
    canvas.setFillColor(BG1)
    canvas.rect(0, H - 48, W, 48, fill=1, stroke=0)

    # Gradient top line
    from reportlab.lib.colors import linearlyInterpolatedColor
    steps = 80
    for i in range(steps):
        t = i / steps
        c = (linearlyInterpolatedColor(BLUE, TEAL, 0, 1, t * 2)
             if t < 0.5 else
             linearlyInterpolatedColor(TEAL, GREEN, 0, 1, (t - 0.5) * 2))
        canvas.setFillColor(c)
        canvas.rect(W * i / steps, H - 2, W / steps + 1, 2, fill=1, stroke=0)

    # Footer rule
    canvas.setStrokeColor(LINE2)
    canvas.setLineWidth(0.4)
    canvas.line(doc.leftMargin, 36, W - doc.rightMargin, 36)

    # Footer text
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(TEXT4)
    canvas.drawCentredString(W / 2, 22,
        'Alexecutive Career Ops  ·  Self-Hosted  ·  Private  ·  Provider-Agnostic AI')
    canvas.setFont('Helvetica', 7)
    canvas.drawRightString(W - doc.rightMargin, 22, f'Page {doc.page}')

    canvas.restoreState()


# ── Style factory ──────────────────────────────────────────────────────────────
def styles(cw):
    base = dict(fontName='Helvetica', textColor=TEXT2, leading=15)
    return {
        # Cover
        'h_cover':   ParagraphStyle('h_cover',   fontName='Helvetica-Bold', fontSize=34,
                                     textColor=WHITE,  alignment=TA_CENTER, leading=40, spaceAfter=6),
        'sub_cover': ParagraphStyle('sub_cover', fontName='Helvetica',      fontSize=15,
                                     textColor=TEXT2,  alignment=TA_CENTER, leading=22, spaceAfter=4),
        'tag_cover': ParagraphStyle('tag_cover', fontName='Helvetica',      fontSize=9,
                                     textColor=TEXT3,  alignment=TA_CENTER, leading=14),
        # Page title
        'h1':        ParagraphStyle('h1',   fontName='Helvetica-Bold', fontSize=22,
                                     textColor=TEXT,  leading=28, spaceAfter=3),
        'h1_sub':    ParagraphStyle('h1sub',fontName='Helvetica',      fontSize=12,
                                     textColor=TEXT2, leading=18, spaceAfter=12),
        # Eyebrow
        'eyebrow':   ParagraphStyle('eyebrow', fontName='Helvetica-Bold', fontSize=8,
                                     textColor=TEXT3, leading=12, spaceAfter=6, spaceBefore=14,
                                     textTransform='uppercase'),
        # Body
        'body':      ParagraphStyle('body',  **base, fontSize=10, spaceAfter=5),
        'body_bold': ParagraphStyle('bodyb', fontName='Helvetica-Bold', fontSize=10,
                                     textColor=TEXT, leading=15, spaceAfter=4),
        'note':      ParagraphStyle('note',  fontName='Helvetica-Oblique', fontSize=9,
                                     textColor=TEXT3, leading=14, spaceAfter=4, leftIndent=8),
        # Steps
        'step_num':  ParagraphStyle('snum', fontName='Helvetica-Bold', fontSize=8,
                                     textColor=BLUE,  leading=12, spaceAfter=1),
        'step_h':    ParagraphStyle('sh',   fontName='Helvetica-Bold', fontSize=12,
                                     textColor=TEXT,  leading=16, spaceAfter=2),
        'step_b':    ParagraphStyle('sb',   fontName='Helvetica', textColor=TEXT2, fontSize=9.5, leading=14,
                                     spaceAfter=4, leftIndent=0),
        # Table cells
        'th':        ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=8.5, textColor=TEXT3),
        'td':        ParagraphStyle('td', fontName='Helvetica',      fontSize=9,   textColor=TEXT2, leading=13),
        'td_code':   ParagraphStyle('tdc',fontName='Courier',        fontSize=8.5, textColor=GREEN),
        'td_amber':  ParagraphStyle('tda',fontName='Helvetica',      fontSize=9,   textColor=AMBER, leading=13),
        # Code block (table cell style)
        'code':      ParagraphStyle('code', fontName='Courier', fontSize=9, textColor=GREEN,
                                     leading=14, backColor=BG3, borderPadding=(6, 8, 6, 8)),
        'code_cmd':  ParagraphStyle('cdcm', fontName='Courier-Bold', fontSize=9, textColor=TEAL,
                                     leading=14, backColor=BG3, borderPadding=(6, 8, 6, 8)),
        'code_env':  ParagraphStyle('cdev', fontName='Courier', fontSize=9, textColor=AMBER,
                                     leading=14, backColor=BG3, borderPadding=(6, 8, 6, 8)),
        # Feature grid cells
        'feat_title':ParagraphStyle('ft', fontName='Helvetica-Bold', fontSize=10,
                                     textColor=TEXT,  leading=14, spaceAfter=2),
        'feat_desc': ParagraphStyle('fd', fontName='Helvetica',      fontSize=8.5,
                                     textColor=TEXT2, leading=13),
        'footer':    ParagraphStyle('foot', fontName='Helvetica', fontSize=7.5,
                                     textColor=TEXT4, alignment=TA_CENTER),
    }


# ── Table presets ──────────────────────────────────────────────────────────────
def base_table_style():
    return [
        ('BACKGROUND',    (0, 0), (-1, 0),  BG3),
        ('ROWBACKGROUNDS',(0, 1), (-1, -1), [BG1, BG2]),
        ('FONTNAME',      (0, 0), (-1, 0),  'Helvetica-Bold'),
        ('FONTSIZE',      (0, 0), (-1, -1), 9),
        ('TEXTCOLOR',     (0, 0), (-1, 0),  TEXT3),
        ('TEXTCOLOR',     (0, 1), (-1, -1), TEXT2),
        ('TOPPADDING',    (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
        ('LEFTPADDING',   (0, 0), (-1, -1), 10),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
        ('LINEBELOW',     (0, 0), (-1, -2), 0.4, LINE),
        ('LINEBELOW',     (0, 0), (-1, 0),  0.5, LINE2),
        ('BOX',           (0, 0), (-1, -1), 0.5, LINE2),
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
    ]


def code_table_style():
    return [
        ('BACKGROUND',  (0, 0), (-1, -1), BG3),
        ('BOX',         (0, 0), (-1, -1), 0.5, LINE2),
        ('TOPPADDING',  (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING',(0,0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 12),
        ('RIGHTPADDING',(0, 0), (-1, -1), 12),
        ('ROWBACKGROUNDS',(0,0),(-1,-1),  [BG3]),
        ('LINEBELOW',   (0, 0), (-1, -2), 0.3, LINE),
    ]


# ── Helpers ────────────────────────────────────────────────────────────────────
def sp(n=8):        return Spacer(1, n)
def grad(w):        return GradientBar(w)


def code_block(lines, cw, S):
    """Dark-background code block using a single-column Table of Paragraphs."""
    rows = []
    for line in lines:
        if line.startswith('$ ') or line.startswith('>>>'):
            style = S['code_cmd']
        elif '=' in line and not line.startswith(' ') and not line.startswith('#'):
            style = S['code_env']
        else:
            style = S['code']
        rows.append([Paragraph(line, style)])
    t = Table(rows, colWidths=[cw])
    t.setStyle(TableStyle(code_table_style()))
    return t


def step_card(num, title, desc, sub=None, code_lines=None, cw=None, S=None):
    """A step block: number pill + title + description, optional note + code."""
    header_row = Table([[
        Paragraph(f'STEP {num}', S['step_num']),
        Paragraph(title, S['step_h']),
    ]], colWidths=[cw * 0.12, cw * 0.88])
    header_row.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, -1), BG2),
        ('TOPPADDING',   (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 9),
        ('LEFTPADDING',  (0, 0), (0, 0),   12),
        ('LEFTPADDING',  (1, 0), (1, 0),   6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ('LINEBEFORE',   (0, 0), (0, 0),   3, BLUE),
        ('BOX',          (0, 0), (-1, -1), 0.4, LINE2),
    ]))

    body_items = [Paragraph(desc.replace('\n', '<br/>'), S['step_b'])]
    if sub:
        body_items.append(Paragraph(f'→  {sub}', S['note']))

    body_row = Table([[body_items]], colWidths=[cw])
    body_row.setStyle(TableStyle([
        ('BACKGROUND',   (0, 0), (-1, -1), BG1),
        ('BOX',          (0, 0), (-1, -1), 0.4, LINE2),
        ('TOPPADDING',   (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 9),
        ('LEFTPADDING',  (0, 0), (-1, -1), 14),
        ('RIGHTPADDING', (0, 0), (-1, -1), 14),
        ('VALIGN',       (0, 0), (-1, -1), 'TOP'),
    ]))

    parts = [header_row, body_row]
    if code_lines:
        parts.append(sp(3))
        parts.append(code_block(code_lines, cw - 28, S))
    parts.append(sp(8))
    return KeepTogether(parts)


def _hex(c):
    """Convert a ReportLab color object to a #rrggbb hex string for inline markup."""
    r = int(round(c.red   * 255))
    g = int(round(c.green * 255))
    b = int(round(c.blue  * 255))
    return f'#{r:02x}{g:02x}{b:02x}'


def feature_grid(features, cw, S):
    """
    Two-column feature grid. features = list of (dot_color, title, desc).
    Flat Paragraph list per cell — no nested tables, no SPAN — guaranteed no overflow.
    """
    # Account for 10px left+right padding per column (set in TableStyle below)
    col_w = (cw - 12) / 2   # 6px gap between columns

    # Shared styles for cell title and description
    title_s = S['feat_title']
    desc_s  = S['feat_desc']

    rows = []
    for i in range(0, len(features), 2):
        row = []
        for feat in features[i:i+2]:
            dot_color, title, desc = feat
            hex_c = _hex(dot_color)
            # Inline colored square bullet before title — flat list, no nested tables
            cell = [
                Paragraph(f'<font color="{hex_c}">■</font>  {title}', title_s),
                Paragraph(desc, desc_s),
            ]
            row.append(cell)
        if len(row) == 1:
            row.append('')
        rows.append(row)

    grid = Table(rows, colWidths=[col_w, col_w], hAlign='LEFT')
    grid.setStyle(TableStyle([
        ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING',    (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 11),
        ('LEFTPADDING',   (0, 0), (-1, -1), 10),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 10),
        ('LINEBELOW',     (0, 0), (-1, -2), 0.3, LINE),
        ('LINEAFTER',     (0, 0), (0, -1),  0.3, LINE),
        ('BACKGROUND',    (0, 0), (-1, -1), BG1),
        ('BOX',           (0, 0), (-1, -1), 0.4, LINE2),
    ]))
    return grid


# ── Build ──────────────────────────────────────────────────────────────────────
def build(out):
    W, H = letter
    M = 0.55 * inch
    CW = W - 2 * M

    doc = SimpleDocTemplate(
        out, pagesize=letter,
        leftMargin=M, rightMargin=M,
        topMargin=0.6 * inch, bottomMargin=0.55 * inch,
        title='Alexecutive Career Ops — Setup Guide',
        author='Alexecutive Career Ops',
    )

    S = styles(CW)
    story = []

    # ── PAGE 1: Cover ──────────────────────────────────────────────────────────
    story += [
        sp(52),
        grad(CW), sp(28),
        Paragraph('Alexecutive Career Ops', S['h_cover']),
        sp(6),
        Paragraph('AI-Powered Career Command Center', S['sub_cover']),
        Paragraph('Setup &amp; User Guide', S['sub_cover']),
        sp(22),
        Paragraph('Self-Hosted  ·  Private  ·  Works with Anthropic, NVIDIA, OpenAI, Ollama, Groq, Gemini &amp; more', S['tag_cover']),
        sp(36),
        grad(CW), sp(20),
    ]

    # Cover feature strip
    cover_feats = [
        ('Live Multi-Board Job Search',    'Whole-web coverage: Google for Jobs (via your connected Google account) · Open-Web Aggregators (The Muse 400k+, Arbeitnow, RemoteOK, Himalayas, Jobicy) · DIRECT company sites (16 majors: Amazon, Netflix, NVIDIA, Disney/Hulu, Intel, PayPal, Adobe &amp; more) · any-company resolver (Apple/Google/Tesla + ~90 majors) · size &amp; industry filters · LinkedIn · Indeed · Glassdoor/Zip via your account — 70 US metros'),
        ('AI Match Scoring + ATS Keywords','1.0–5.0 score + verdict + live keyword match % on every card'),
        ('Style-Preserving Resume Tailoring','Rewrites content, mirrors your exact formatting and brand'),
        ('Apply Queue + Writing Style', 'Batch-queue jobs → AI packets in your style (cover letter + Q&A) → one-click copy'),
        ('Outreach, Interview Prep & Analytics','LinkedIn messages, STAR answers, pipeline analytics, skills gap, blind spots'),
        ('Application Tracker',            'Full pipeline: Saved → Applied → Interview → Offer'),
    ]
    cover_rows = [[
        Paragraph(t, ParagraphStyle('ct', fontName='Helvetica-Bold', fontSize=9, textColor=TEXT, leading=13)),
        Paragraph(d, ParagraphStyle('cd', fontName='Helvetica', fontSize=8.5, textColor=TEXT3, leading=13)),
    ] for t, d in cover_feats]
    cover_tbl = Table(cover_rows, colWidths=[CW * 0.35, CW * 0.65])
    cover_tbl.setStyle(TableStyle([
        ('TOPPADDING',   (0,0),(-1,-1), 5),
        ('BOTTOMPADDING',(0,0),(-1,-1), 5),
        ('LEFTPADDING',  (0,0),(-1,-1), 0),
        ('RIGHTPADDING', (0,0),(-1,-1), 0),
        ('VALIGN',       (0,0),(-1,-1), 'TOP'),
        ('LINEBELOW',    (0,0),(-1,-2), 0.3, LINE),
    ]))
    story.append(cover_tbl)
    story.append(PageBreak())

    # ── PAGE 2: What Is This ───────────────────────────────────────────────────
    story += [
        sp(6),
        Paragraph('What Is Alexecutive Career Ops?', S['h1']),
        Paragraph('Your career, accelerated. A self-hosted browser dashboard '
                  'combining job search, AI evaluation, resume tailoring, '
                  'and application tracking in one place.', S['h1_sub']),
        grad(CW), sp(12),
        Paragraph(
            'Alexecutive Career Ops is built for non-technical through semi-technical professionals — '
            'Analytics, Operations, Finance, Product Management, Business Strategy, Legal, '
            'Healthcare, Creative/Marketing, Sales, Executive, HR, and more. Every AI feature '
            'adapts its scoring language and evaluation criteria to the industry archetype it '
            'detects from the job description.',
            S['body']),
        Paragraph(
            'All data stays on your machine. Your resume, profile, and application history '
            'live in a local <font face="Courier" size="9">data/</font> folder — nothing '
            'is shared between users or sent to any third party beyond your own Anthropic API calls.',
            S['body']),
        sp(14),
    ]

    features = [
        (BLUE,  'Live Multi-Board Job Search',
                '12 verified sources: LinkedIn + Indeed (JobSpy), Google for Jobs (beta), direct company career pages via Greenhouse (70+ companies), Lever, and Ashby, plus Wellfound, Y Combinator, startup.jobs, Welcome to the Jungle, Cord, Built In, and Remotive. Location supports metro/region searches (Raleigh-Durham, Dallas-Fort Worth, Bay Area) matching every city in the metro. Glassdoor and ZipRecruiter search through YOUR connected account (connect once in Profile → Platform Accounts; their checkboxes unlock automatically). Deduplicates across sources; AI scoring runs in token-budgeted, rate-limited batches.'),
        (TEAL,  'AI Match Scoring + ATS Keywords',
                'Instant hybrid ranking (lexical + vector, Google/LinkedIn-style) against your profile on every result, then 1.0-5.0 AI scores with Apply/Consider/Skip verdicts stream in as background enrichment — searches never block on AI.'),
        (GREEN, 'Apply Queue',
                'Auto-queue jobs by score threshold or batch-select. Batch apply modal generates a full Application Packet (cover letter, pitch, Q&A, ATS keywords) in your writing style, with one-click copy per field.'),
        (AMBER, 'Writing Style + Cover Letter Voice',
                '8 application styles: Professional, Formal, Technical, Executive, Conversational, Creative, Concise, Academic. Upload a past cover letter — the AI mirrors your exact sentence structure, vocabulary, and rhythm in every generated packet.'),
        (BLUE,  'Style-Preserving Resume Tailoring',
                'Rewrites resume content with targeted keywords while exactly mirroring your original section order, header style, bullet format, and tone.'),
        (TEAL,  'Outreach & Networking',
                'AI-generates LinkedIn messages, cold emails, referral asks, and follow-ups for any contact. Built-in Network CRM tracks contacts and follow-up status.'),
        (GREEN, 'Interview Prep Suite',
                'STAR answer generator, company research brief, role-specific tech Q&A with difficulty ratings, and mock interview feedback with AI-rewritten model answers.'),
        (BLUE,  'Analytics Dashboard',
                'Pipeline funnel with per-source response rates, score distribution, application timing heatmap, skills gap roadmap with learning resources, and blind spot detector.'),
        (TEAL,  'LinkedIn Optimizer',
                'Rewrites headline, About section, experience bullets, and top skills keywords for maximum recruiter discoverability.'),
        (GREEN, 'CV Generation',
                'Produces a full professional CV for any role, built from your experience, in the same visual style as your uploaded resume.'),
        (BLUE,  'Application Tracker',
                'Full status pipeline: Saved → Applied → Screening → Interview → Offer → Accepted / Rejected. Includes offer analysis and negotiation script generation.'),
        (TEAL,  'Resume Versions',
                'Save, name, and switch between multiple tailored resume versions. Promote any version to active with one click.'),
    ]
    story.append(feature_grid(features, CW, S))
    story.append(PageBreak())

    # ── PAGE 3: Prerequisites & Installation ───────────────────────────────────
    story += [
        sp(6),
        Paragraph('Installation', S['h1']),
        Paragraph('You need Node.js and 5 minutes. No API key required to get started.', S['h1_sub']),
        grad(CW), sp(12),
        Paragraph('PREREQUISITES', S['eyebrow']),
    ]

    prereq = [
        [Paragraph(h, S['th']) for h in ['Requirement', 'Version', 'How to Install']],
        [Paragraph('Node.js', S['td']),       Paragraph('20+',              S['td']),
         Paragraph('nodejs.org  or:  brew install node',    S['td'])],
        [Paragraph('Python 3', S['td']),       Paragraph('3.9+  (optional)', S['td']),
         Paragraph('python.org  or:  brew install python',  S['td'])],
        [Paragraph('python-jobspy', S['td']), Paragraph('latest  (optional)', S['td']),
         Paragraph('pip install python-jobspy',             S['td_code'])],
    ]
    pt = Table(prereq, colWidths=[CW*0.28, CW*0.22, CW*0.50])
    pt.setStyle(TableStyle(base_table_style()))
    story += [pt, sp(5),
              Paragraph('Python + python-jobspy is optional but strongly recommended — it unlocks '
                        'LinkedIn, Indeed, and Google for Jobs. Without it, direct company career '
                        'pages still run: Greenhouse, Lever, Ashby, Wellfound, Y Combinator, startup.jobs, '
                        'Welcome to the Jungle, Cord, Built In, and Remotive. Glassdoor and ZipRecruiter '
                        'block automated search upstream and are marked blocked in the UI.', S['note']),
              sp(14),
              Paragraph('INSTALLATION STEPS', S['eyebrow'])]

    story.append(step_card(1, 'Open the project folder in Terminal',
        'Open Terminal (Mac) or Command Prompt (Windows). '
        'The project folder is named "Alexecutive Career Ops" — typically on your Desktop. '
        'Replace ~/Desktop below with the actual location if you moved it:',
        code_lines=['$ cd ~/Desktop/"Alexecutive Career Ops"'], cw=CW, S=S))

    story.append(step_card(2, 'Install Node.js dependencies',
        'Run this from inside the project folder (you must have completed Step 1 first):',
        code_lines=['$ npm install'], cw=CW, S=S))

    story.append(step_card(3, 'Install live job search (recommended)',
        'Enables LinkedIn, Indeed, and Google for Jobs:',
        code_lines=['$ pip install python-jobspy'], cw=CW, S=S))

    story.append(step_card(4, 'Start the server',
        'Launch Alexecutive Career Ops. The terminal stays open while the app is running.',
        code_lines=['$ npm start'], cw=CW, S=S))

    story += [sp(6), Paragraph('Then open your browser and go to:', S['body_bold']),
              sp(4), code_block(['http://localhost:3000'], CW, S)]
    story.append(PageBreak())

    # ── PAGE 4: First-Time Browser Setup ──────────────────────────────────────
    story += [
        sp(6),
        Paragraph('First-Time Browser Setup', S['h1']),
        Paragraph('Complete these four steps once — takes about 5 minutes.', S['h1_sub']),
        grad(CW), sp(12),
    ]

    setup = [
        (BLUE, '1', 'Choose Your AI Provider',
         'Navigate to <b>Settings</b> (bottom of the left sidebar) → AI Provider → select a provider tab → follow setup steps → Save.',
         'Nine providers supported: NVIDIA (recommended free option — 70B-class quality via build.nvidia.com), '
         'Anthropic (best absolute quality, pay-per-token), OpenAI, Meta Llama API (free preview), Ollama (free, local), '
         'Groq (free tier), OpenRouter, Google Gemini (free tier on 2.5-flash models), and any custom endpoint. '
         'Each provider keeps its own saved key, and all requests are automatically rate-limited to free-tier limits. '
         'A Claude.ai Pro or Max subscription does not include API access — those are separate Anthropic products.'),
        (TEAL, '2', 'Upload Your Resume',
         'Navigate to <b>Resume &amp; CV</b> in the sidebar.',
         'Drag and drop a PDF, DOCX, or TXT file · paste text directly · or drop in URLs '
         '(LinkedIn profile, GitHub, portfolio). The app extracts your experience, skills, and '
         'style metadata — your section order, header style, bullet format, and date format are '
         'preserved on every tailored output.'),
        (GREEN, '3', 'Fill In Your Profile',
         'Navigate to <b>Profile &amp; Settings</b> and fill in your details.',
         'Target roles (e.g. "Operations Manager", "Senior Financial Analyst", "Product Manager") · '
         'Primary industry · Target salary range · Remote / hybrid / on-site preference. '
         'The AI uses these to score every job result against your specific goals.'),
        (BLUE, '4', 'Run Your First Job Search',
         'Navigate to <b>Job Search</b> → enter keywords → click Search Jobs.',
         'Results stream in live from all connected boards. Each card shows an AI match '
         'score (1.0–5.0), Apply / Consider / Skip verdict, location, salary, and source board.'),
    ]

    for color, num, title, desc, sub in setup:
        hdr = Table([[
            Paragraph(f'Step {num}', ParagraphStyle('sn2', fontName='Helvetica-Bold', fontSize=9,
                                                     textColor=color)),
            Paragraph(title, ParagraphStyle('st2', fontName='Helvetica-Bold', fontSize=13,
                                             textColor=TEXT)),
        ]], colWidths=[CW * 0.12, CW * 0.88])
        hdr.setStyle(TableStyle([
            ('BACKGROUND',    (0,0),(-1,-1), BG2),
            ('TOPPADDING',    (0,0),(-1,-1), 10),
            ('BOTTOMPADDING', (0,0),(-1,-1), 10),
            ('LEFTPADDING',   (0,0),(0,0),   12),
            ('LEFTPADDING',   (1,0),(1,0),   6),
            ('RIGHTPADDING',  (0,0),(-1,-1), 10),
            ('VALIGN',        (0,0),(-1,-1), 'MIDDLE'),
            ('LINEBEFORE',    (0,0),(0,0),   3, color),
            ('BOX',           (0,0),(-1,-1), 0.4, LINE2),
        ]))
        bdy = Table([[
            [Paragraph(desc, S['step_b']), sp(4),
             Paragraph(f'→  {sub}', S['note'])]
        ]], colWidths=[CW])
        bdy.setStyle(TableStyle([
            ('BACKGROUND',    (0,0),(-1,-1), BG1),
            ('BOX',           (0,0),(-1,-1), 0.4, LINE2),
            ('TOPPADDING',    (0,0),(-1,-1), 10),
            ('BOTTOMPADDING', (0,0),(-1,-1), 10),
            ('LEFTPADDING',   (0,0),(-1,-1), 14),
            ('RIGHTPADDING',  (0,0),(-1,-1), 14),
            ('VALIGN',        (0,0),(-1,-1), 'TOP'),
        ]))
        story.append(KeepTogether([hdr, bdy, sp(10)]))

    story.append(PageBreak())

    # ── PAGE 5: Features Reference ─────────────────────────────────────────────
    story += [
        sp(6),
        Paragraph('Features &amp; How to Use Them', S['h1']),
        Paragraph('Quick reference for every capability in the dashboard.', S['h1_sub']),
        grad(CW), sp(12),
    ]

    feat_rows = [
        [Paragraph(h, S['th']) for h in ['Feature', 'Navigate To', 'What To Do']],
        *[[Paragraph(f, S['td']), Paragraph(n, S['td']), Paragraph(a, S['td'])] for f, n, a in [
            ('Job Search',             'Job Search',                                'Add multiple keywords/roles as tags with autocomplete → Search Jobs'),
            ('Location Filter',        'Job Search → Location field',               'Add one or more locations as tags; results filtered to matching cities/states'),
            ('Apply Queue (auto)',      'Job Search → Auto-Queue Threshold',         'Set score threshold → matching jobs queue automatically'),
            ('Apply Queue (manual)',    'Job Search → Select',                       'Select mode → pick cards → Queue Selected'),
            ('Process Queue',          'Applications → Process Apply Queue',        'Batch modal → AI packets with one-click copy per job'),
            ('Writing Style',          'Resume &amp; CV → Application Writing Style','Click a style pill — applied to all future packets'),
            ('Cover Letter Sample',    'Resume &amp; CV → Cover Letter Sample',     'Upload/paste a past letter → AI mirrors your voice'),
            ('Target Companies',       'Job Search → Target Companies',             'Type company name → Enter'),
            ('Exclude Companies',      'Job Search → Exclude Companies',            'Type company name → Enter'),
            ('Quick AI Score',         'Every job card',                            'Automatic — shown during search'),
            ('Full Evaluation (A–F)',  'Any job card → Evaluate',                  'Opens 6-block detailed report'),
            ('Auto-Apply Guide',       'Any job card → Auto Apply',                'Prefilled copy-paste guide for the ATS'),
            ('ATS Resume Score',       'Resume &amp; CV → Run ATS Check',          'Scores against 12 ATS compatibility rules'),
            ('Tailor Resume',          'Resume &amp; CV → paste JD → Tailor',      'Style-preserving ATS-optimized rewrite'),
            ('Generate CV',            'Resume &amp; CV → paste JD → CV',          'Full professional CV in your original style'),
            ('Outreach',               'Outreach &amp; Network',                    'LinkedIn messages, cold emails, referral asks, follow-ups'),
            ('Interview Prep',         'Interview Prep',                            'STAR answers, company brief, tech Q&amp;A, mock feedback'),
            ('Analytics',              'Analytics',                                 'Pipeline funnel, skills gap, blind spots, timing heatmap'),
            ('LinkedIn Optimizer',     'LinkedIn Optimizer',                        'Auto-fills from connected LinkedIn account or stored profile; AI grades your profile against the optimization checklist (pass/fail + 0-10 per item with feedback) and writes ready-to-paste headline, About, skills, and per-role bullet rewrites grounded in your resume'),
            ('Track Applications',     'Applications',                              'Update status as you progress'),
            ('CSV Export',             'Dashboard → Export CSV',                   'Google Sheets / Excel one-click download'),
            ('Save Session',           'Topbar → Save button',                     'Names and saves a snapshot of all current data'),
            ('New Session',            'Topbar → Sessions → New Session',          'Clears applications and starts fresh; previous data auto-saved first'),
            ('Restore Session',        'Topbar → Sessions → Restore',              'Loads a past snapshot — applications, resume, profile all restored'),
            ('Auto-Save',              'Runs automatically',                       'Every 5 min the app silently saves your active session; indicator in sidebar'),
            ('Connect Platform',       'Settings → Platform Accounts → Connect',   'Opens a real browser — sign in yourself; session cookies saved locally'),
            ('Sync Profile',           'Settings → Platform Accounts → Sync',      'Pulls live LinkedIn profile; apply selected fields to stored profile; auto-fills LinkedIn Optimizer'),
            ('Disconnect Platform',    'Settings → Platform Accounts → Disconnect','Deletes saved session cookies; reconnect any time'),
        ]]
    ]
    ft = Table(feat_rows, colWidths=[CW*0.27, CW*0.37, CW*0.36])
    ft.setStyle(TableStyle(base_table_style()))
    story.append(ft)
    story += [
        sp(14),
        Paragraph('RESUME STYLE PRESERVATION', S['eyebrow']),
        Paragraph(
            'When you upload your resume, Alexecutive Career Ops analyses your original formatting: '
            'section order, header capitalization, bullet punctuation, date formats, and visual tone. '
            'Every tailored resume and generated CV mirrors your exact branding — the output looks '
            'like <i>your</i> document with updated content, not a new template imposed on top.',
            S['body']),
    ]
    story.append(PageBreak())

    # ── PAGE 6: Feature Walkthrough ────────────────────────────────────────────
    story += [
        sp(6),
        Paragraph('Feature Walkthrough', S['h1']),
        Paragraph('Step-by-step interactive guide for every section of the dashboard.', S['h1_sub']),
        grad(CW), sp(12),
    ]

    walkthrough = [
        (BLUE, 'Job Search', [
            ('Open Job Search', 'Click "Job Search" in the left sidebar.'),
            ('Enter keywords', 'Type a role or skill in the search box (e.g. "Operations Manager").'),
            ('Set filters', 'Use Career Level checkboxes to narrow seniority. Set Min Salary and Remote / Hybrid / On-Site preference as needed.'),
            ('Target or exclude companies', 'Type a company name into "Target Companies" to limit results to that employer, or "Exclude Companies" to hide it from all results.'),
            ('Run the search', 'Click Search Jobs. Results stream in live. Each card auto-shows an AI score (1.0–5.0) and Apply / Consider / Skip verdict.'),
            ('Estimate salary', 'On any card without a posted salary, click "Est. Salary" to see AI-estimated p25 / p50 / p75 / p90 salary bands.'),
        ]),
        (TEAL, 'Evaluate a Job', [
            ('Find a card', 'Any job card in Job Search results can be fully evaluated.'),
            ('Click Evaluate', 'Press the "Evaluate" button on the card. The AI runs a 6-block analysis: Fit Summary, Requirements, Positioning, Compensation, Resume Edits, and Interview Prep — graded A–F.'),
            ('Review the report', 'A modal opens with the full report. Sections are color-coded by grade. Use "Resume Edits" to see exactly which keywords to add.'),
            ('Auto-Apply Guide', 'Click "Auto Apply" on any card to get a prefilled step-by-step ATS guide with copy buttons for every required field.'),
        ]),
        (GREEN, 'Resume & CV', [
            ('Upload your resume', 'Go to Resume & CV → drag and drop a PDF, DOCX, or TXT file onto the upload zone, or paste text directly.'),
            ('Add URL context', 'Paste your LinkedIn, GitHub, or portfolio URL into the URL field and click Add. These are stored as AI context for all evaluations.'),
            ('Run ATS Check', 'Click "Run ATS Check" to score your current resume against 12 ATS compatibility rules. Gaps are listed with fix suggestions.'),
            ('Tailor your resume', 'Paste a job description into the Job Description box → click "Tailor Resume". The AI rewrites your resume with targeted keywords while preserving your exact formatting.'),
            ('Generate a CV', 'Paste a job description → click "Generate CV" to produce a full professional CV in your original document style.'),
        ]),
        (AMBER, 'LinkedIn Optimizer', [
            ('Open the optimizer', 'Click "LinkedIn Optimizer" in the left sidebar.'),
            ('Paste your current profile', 'Paste your current headline, About section, and a few experience bullets into the input boxes.'),
            ('Run the optimizer', 'Click Optimize. The AI rewrites your headline for recruiter search, expands your About for keyword density, and sharpens experience bullets with impact language.'),
            ('Copy each section', 'Each output block has a copy button. Paste directly into the LinkedIn profile editor for each section.'),
        ]),
        (TEAL, 'Applications Tracker', [
            ('Save a job', 'From any job card in Job Search, click Save. The job is added to your Applications Tracker immediately.'),
            ('Update status', 'Go to Applications in the sidebar. Each row has a Status dropdown — click it and select the current stage: Applied, Responded, Interview, Offer, Accepted, or Rejected.'),
            ('Add notes', 'Click the Notes cell in any row to edit notes inline. Type your note and press Enter or click away to save.'),
            ('Filter and search', 'Use the search box to find by company or role. Click a status pill to filter to that stage only.'),
            ('Export', 'Click "Export" in the Applications header to download your full tracker as a CSV for Google Sheets or Excel.'),
        ]),
        (GREEN, 'Settings & AI Provider', [
            ('Open Settings', 'Click "Profile & Settings" in the left sidebar, then select the AI Provider tab.'),
            ('Choose a provider', 'Click a provider tab (Anthropic, NVIDIA, OpenAI, Meta Llama, Ollama, Groq, OpenRouter, Gemini, or Custom). Setup steps for that provider appear below.'),
            ('Enter credentials', 'Paste your API key into the field shown. A saved key shows as masked dots with a green check — it is stored in full, not truncated. NVIDIA model IDs need the org prefix (meta/llama-3.3-70b-instruct); bare names are auto-corrected. Ollama requires no key.'),
            ('Override models (optional)', 'Expand "Model Overrides" to set a custom fast or power model name for any provider.'),
            ('Save', 'Click Save Provider. All future AI calls route through your selected provider immediately.'),
        ]),
        (INDIGO, 'Session Management', [
            ('What is a session?', 'A session is a named snapshot of your working state: all applications, your resume, profile, cover letter, and writing style. Your AI provider config is global and is never stored in sessions.'),
            ('Save a session', 'Click the Save button in the top bar. Enter a name (e.g. "Aug 2026 Search") and click Save Session. The current session name and last-saved time appear in the bottom-left sidebar.'),
            ('Auto-save', 'The app automatically saves your active session every 5 minutes in the background. The sidebar shows the last saved time so you always know your data is safe.'),
            ('Start a new session', 'Click Sessions in the topbar → New Session. Your current data is auto-saved first, then applications are cleared for a fresh start. Your profile, API keys, and resume are always kept unless you uncheck "Keep resume".'),
            ('Restore a past session', 'Click Sessions → Restore on any saved session. Your current live data is replaced with the snapshot. Use this to switch between multiple job search campaigns.'),
            ('Clean first launch', 'When you open the app with no data (fresh install or after starting a new session), the dashboard shows a 3-step setup card: add API key → upload resume → search jobs. No stale data is shown.'),
        ]),
        (ROSE, 'Platform Accounts', [
            ('Why connect?', 'Connecting LinkedIn, Indeed, or Glassdoor lets Alexecutive sync your live profile data and pre-fill Easy Apply forms using your real account session — no re-typing required.'),
            ('How to connect', 'Go to Settings → Platform Accounts → click Connect next to any platform. A real browser window opens at that platform\'s login page. Sign in with your own credentials — the app never sees or stores your password.'),
            ('Session saved automatically', 'Once your login is detected (the URL changes to your feed or dashboard), the session is saved locally to data/platform-sessions/{platform}.json. The browser closes and the card updates to "Connected".'),
            ('Sync your profile', 'Click Sync Profile next to LinkedIn. Alexecutive opens a browser using your saved session, loads your profile page, and extracts your name, headline, location, about section, and skills. A diff window lets you choose which fields to apply.'),
            ('Disconnect', 'Click Disconnect next to any platform at any time. Your saved cookie file is deleted immediately. No other data is removed.'),
            ('Your credentials stay private', 'Alexecutive only stores the session cookies your browser creates after you log in — the same data any browser\'s "Remember Me" feature uses. Your email and password are never recorded anywhere.'),
        ]),
    ]

    for color, section, steps in walkthrough:
        # Section header
        sec_hdr = Table([[
            Paragraph(section, ParagraphStyle('wh', fontName='Helvetica-Bold', fontSize=12, textColor=color)),
        ]], colWidths=[CW])
        sec_hdr.setStyle(TableStyle([
            ('BACKGROUND',    (0,0),(-1,-1), BG2),
            ('TOPPADDING',    (0,0),(-1,-1), 8),
            ('BOTTOMPADDING', (0,0),(-1,-1), 8),
            ('LEFTPADDING',   (0,0),(-1,-1), 12),
            ('RIGHTPADDING',  (0,0),(-1,-1), 12),
            ('LINEBEFORE',    (0,0),(0,-1),  3, color),
            ('BOX',           (0,0),(-1,-1), 0.4, LINE2),
        ]))
        # Steps rows
        step_rows = []
        for i, (step_title, step_desc) in enumerate(steps):
            num_s = ParagraphStyle('wn', fontName='Helvetica-Bold', fontSize=8, textColor=color)
            t_s   = ParagraphStyle('wt', fontName='Helvetica-Bold', fontSize=9, textColor=TEXT)
            d_s   = ParagraphStyle('wd', fontName='Helvetica',      fontSize=8.5, textColor=TEXT2, leading=13)
            step_rows.append([
                Paragraph(str(i + 1), num_s),
                [Paragraph(step_title, t_s), Paragraph(step_desc, d_s)],
            ])
        steps_tbl = Table(step_rows, colWidths=[CW * 0.06, CW * 0.94])
        steps_tbl.setStyle(TableStyle([
            ('BACKGROUND',    (0,0),(-1,-1), BG1),
            ('TOPPADDING',    (0,0),(-1,-1), 7),
            ('BOTTOMPADDING', (0,0),(-1,-1), 7),
            ('LEFTPADDING',   (0,0),(0,-1),  12),
            ('LEFTPADDING',   (1,0),(1,-1),  8),
            ('RIGHTPADDING',  (0,0),(-1,-1), 12),
            ('VALIGN',        (0,0),(-1,-1), 'TOP'),
            ('LINEBELOW',     (0,0),(-1,-2), 0.3, LINE),
            ('BOX',           (0,0),(-1,-1), 0.4, LINE2),
        ]))
        story.append(KeepTogether([sec_hdr, steps_tbl, sp(10)]))

    story.append(PageBreak())

    # ── PAGE 7: Sharing + Troubleshooting ─────────────────────────────────────
    story += [
        sp(6),
        Paragraph('Sharing With Others', S['h1']),
        Paragraph('Anyone can run their own private instance — they just need Node.js '
                  'and their own Anthropic API key.', S['h1_sub']),
        grad(CW), sp(12),
        Paragraph('THREE STEPS TO SHARE', S['eyebrow']),
    ]

    story.append(step_card(1, 'Install Node.js 20+',
        'Download from nodejs.org, or on Mac open Terminal and run:', None,
        ['$ brew install node'], CW, S))

    story.append(step_card(2, 'Set up and start the app',
        'Open Terminal and run these commands in order. '
        'Replace ~/Desktop if the project folder is somewhere else:',
        None,
        ['$ cd ~/Desktop/"Alexecutive Career Ops"',
         '$ npm install',
         '$ npm start'], CW, S))

    story.append(step_card(3, 'Choose an AI provider in Settings',
        'Open http://localhost:3000 in your browser, then go to Settings → AI Provider.',
        'Pick any provider tab. NVIDIA (build.nvidia.com) gives free 70B-class quality and is the recommended '
        'free option. Ollama is free with no account. Groq, Gemini, OpenRouter, and Meta Llama API all have free tiers. '
        'Anthropic requires a separate API key from console.anthropic.com (not your Claude.ai subscription).',
        None, CW, S))

    story += [
        Paragraph('All data (resume, profile, applications) stays on each user\'s own machine '
                  'in the data/ folder. Nothing is shared between instances.', S['note']),
        sp(16),
        Paragraph('TROUBLESHOOTING', S['eyebrow']),
    ]

    trouble = [
        [Paragraph(h, S['th']) for h in ['Problem', 'Solution']],
        *[[Paragraph(p, S['td_amber']), Paragraph(s, S['td'])] for p, s in [
            ('No LinkedIn / Indeed results',
             'Run: pip install python-jobspy\n'
             'Verify: python3 -c "from jobspy import scrape_jobs; print(\'OK\')"'),
            ('No Glassdoor / ZipRecruiter results',
             'Not fixable locally — both sites block automated search upstream for all tools '
             '(Glassdoor HTTP 400, ZipRecruiter HTTP 403). Their checkboxes are marked "blocked". '
             'LinkedIn, Indeed, Google for Jobs, and company career pages cover the same postings.'),
            ('NVIDIA "404 page not found"',
             'The model ID is missing its org prefix. Use the full ID from build.nvidia.com, e.g. '
             'meta/llama-3.3-70b-instruct. Current versions auto-correct bare names.'),
            ('NVIDIA 429 / 503 during search',
             'Fixed in current version: requests are rate-limited to 36/min and 4 concurrent with '
             'queueing, retry, and batch scoring (8 jobs per AI call).'),
            ('"API key not configured" error',
             'Settings → AI Provider → choose a provider and enter its key → Save. '
             'For Ollama: no key needed, just ensure Ollama is running locally.'),
            ('Port 3000 already in use (EADDRINUSE)',
             'A previous server is still running. Kill it first, then retry:\n'
             'kill $(lsof -ti:3000)\n'
             'Then run npm start again. Or use a different port: PORT=3001 npm start'),
            ('Server won\'t start / "Cannot find public/" error',
             'You must cd into the project folder before running npm start.\n'
             'Run: cd ~/Desktop/"Alexecutive Career Ops" then npm start'),
            ('Search returns few or no results',
             'Use the "All" button to re-enable any unchecked boards.\n'
             'For LinkedIn/Indeed: verify python-jobspy is installed (pip install python-jobspy).\n'
             'Boards run in parallel and every listed board is verified to return real results.'),
            ('Start over from scratch',
             'Sessions → Full Reset (red button): wipes applications, resume, profile, and cover letter. '
             'AI keys are kept; current data is auto-saved as a restorable session first.'),
            ('Applications reappear after restart',
             'Named sessions persist across restarts. Unsaved application lists are intentionally cleared on startup for a clean slate. Use Sessions → Save to preserve work between sessions.'),
        ]]
    ]
    tt = Table(trouble, colWidths=[CW*0.40, CW*0.60])
    tt.setStyle(TableStyle([
        ('BACKGROUND',    (0,0),(-1,0),   BG3),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),  [BG1, BG2]),
        ('FONTNAME',      (0,0),(-1,0),   'Helvetica-Bold'),
        ('FONTSIZE',      (0,0),(-1,-1),  9),
        ('TEXTCOLOR',     (0,0),(-1,0),   TEXT3),
        ('TOPPADDING',    (0,0),(-1,-1),  7),
        ('BOTTOMPADDING', (0,0),(-1,-1),  7),
        ('LEFTPADDING',   (0,0),(-1,-1),  10),
        ('RIGHTPADDING',  (0,0),(-1,-1),  10),
        ('LINEBELOW',     (0,0),(-1,-2),  0.4, LINE),
        ('LINEBELOW',     (0,0),(-1,0),   0.5, LINE2),
        ('BOX',           (0,0),(-1,-1),  0.5, LINE2),
        ('VALIGN',        (0,0),(-1,-1),  'TOP'),
    ]))
    story.append(tt)
    story += [
        sp(16),
        Paragraph('AI PROVIDER OPTIONS', S['eyebrow']),
    ]

    provider_rows = [
        [Paragraph(h, S['th']) for h in ['Provider', 'Cost', 'How to Get Access']],
        *[[Paragraph(p, S['td']), Paragraph(c, S['td']), Paragraph(h, S['td'])] for p, c, h in [
            ('Anthropic (Claude)',    'Pay-per-token (~$0.80/1M tokens for Haiku)',
             'console.anthropic.com → API Keys. NOTE: separate from Claude.ai Pro/Max.'),
            ('NVIDIA (recommended free)', 'Free API credits, 70B-class quality',
             'build.nvidia.com → any model → Get API Key (starts with nvapi-). Use full model IDs like meta/llama-3.3-70b-instruct.'),
            ('OpenAI (GPT)',          'Pay-per-token',
             'platform.openai.com → API Keys (starts with sk-)'),
            ('Meta Llama API',        'Free preview',
             'llama.developer.meta.com → API Keys'),
            ('Ollama (Local or Cloud)',        'Free — runs on your machine (8B models are weaker than 70B cloud)',
             'Install from ollama.com, then run: ollama pull llama3.1'),
            ('Groq',                 'Free tier + paid plans',
             'Sign up at console.groq.com → API Keys (starts with gsk_)'),
            ('OpenRouter',           'Free models available + paid premium',
             'Sign up at openrouter.ai → Keys (starts with sk-or-)'),
            ('Google Gemini',        'Free tier: 2.5-flash-lite (~1,000/day); 2.0-flash has no free quota',
             'aistudio.google.com → Get API Key (starts with AIza)'),
        ]]
    ]
    prt = Table(provider_rows, colWidths=[CW*0.25, CW*0.28, CW*0.47])
    prt.setStyle(TableStyle(base_table_style()))
    story.append(prt)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f'✓  PDF written → {os.path.abspath(out)}')


if __name__ == '__main__':
    build(OUT)
