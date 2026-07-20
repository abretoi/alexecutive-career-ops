/** API client — Alexecutive Career Ops */

const base = '';

async function req(method, path, body) {
  // Finite ceiling so no request can spin the UI forever — generous enough
  // for the slowest legitimate call (rate-limited 70B generation ≈ 3-4 min).
  const opts = { method, headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(360000) };
  if (body !== undefined) opts.body = JSON.stringify(body);
  let r;
  try {
    r = await fetch(base + path, opts);
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') {
      throw new Error('Request timed out after 6 minutes — the AI provider may be rate-limited or overloaded. Try again, or switch providers in Settings.');
    }
    throw e;
  }
  if (!r.ok) { const t = await r.text(); throw new Error(t || r.statusText); }
  return r.json();
}

export const api = {
  profile: {
    get:       ()       => req('GET',  '/api/profile'),
    save:      (data)   => req('POST', '/api/profile', data),
    scrapeUrl: (url)    => req('POST', '/api/profile/scrape-url', { url }),
  },

  config: {
    get:       ()     => req('GET',  '/api/profile/config'),
    save:      (data) => req('POST', '/api/profile/config', data),
    providers:     ()     => req('GET',  '/api/profile/providers'),
    ollamaStatus:  ()     => req('GET',  '/api/profile/ollama-status'),
  },

  resume: {
    get:         ()       => req('GET',  '/api/resume'),
    atsCheck:    (resume) => req('POST', '/api/resume/ats-check', resume ? { resume } : {}),
    tailor:      (job)    => req('POST', '/api/jobs/tailor', { job }),
    generateCV:          (job)  => req('POST', '/api/resume/generate-cv',           { job }),
    generateCoverLetter: (data) => req('POST', '/api/resume/generate-cover-letter', data),
    exportDoc:   (format) => {
      window.open(`/api/resume/export-doc?format=${format || 'txt'}`, '_blank');
    },
    clear:       ()       => req('DELETE', '/api/resume'),
    update:      (data)   => req('PATCH',  '/api/resume', data),
    exportPdf:   ()       => { window.open('/api/resume/export/pdf', '_blank'); },
    exportDocx:  ()       => { window.open('/api/resume/export/docx', '_blank'); },
    exportCoverLetterPdf:  () => { window.open('/api/resume/cover-letter/export/pdf',  '_blank'); },
    exportCoverLetterDocx: () => { window.open('/api/resume/cover-letter/export/docx', '_blank'); },
    getWritingStyle:  ()     => req('GET',  '/api/resume/writing-style'),
    saveWritingStyle: (data) => req('POST', '/api/resume/writing-style', data),

    upload(file, onProgress) {
      return new Promise((resolve, reject) => {
        const fd  = new FormData();
        const isFile = file instanceof File;
        if (isFile) fd.append('resume', file);
        else fd.set('text', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', isFile ? '/api/resume/upload' : '/api/resume/paste');
        if (onProgress) xhr.upload.onprogress = e => onProgress(e.loaded / e.total);
        xhr.onload  = () => { try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); } };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(fd);
      });
    },

    // Cover letter sample
    getCoverLetter:    ()     => req('GET',    '/api/resume/cover-letter'),
    pasteCoverLetter:  (text) => req('POST',   '/api/resume/cover-letter/paste', { text }),
    deleteCoverLetter: ()     => req('DELETE', '/api/resume/cover-letter'),

    uploadCoverLetter(file, onProgress) {
      return new Promise((resolve, reject) => {
        const fd = new FormData();
        fd.append('file', file);
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/resume/cover-letter/upload');
        if (onProgress) xhr.upload.onprogress = e => onProgress(e.loaded / e.total);
        xhr.onload  = () => { try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); } };
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.send(fd);
      });
    },

    // Writing style
    getWritingStyle:  ()     => req('GET',  '/api/resume/writing-style'),
    saveWritingStyle: (data) => req('POST', '/api/resume/writing-style', data),

    // 4-Persona AI Resume Chain
    chainDiagnoser:     (jd)                    => req('POST', '/api/resume/chain/diagnoser',      { jd }),
    chainRecruiter:     (jd)                    => req('POST', '/api/resume/chain/recruiter',      { jd }),
    chainRewriter:      (jd, missingKeywords)   => req('POST', '/api/resume/chain/rewriter',       { jd, missingKeywords }),
    chainHiringManager: (jd)                    => req('POST', '/api/resume/chain/hiring-manager', { jd }),
  },

  linkedin: {
    optimize: (data) => req('POST', '/api/profile/linkedin', data),
  },

  jobs: {
    evaluate:  (job)             => req('POST', '/api/jobs/evaluate',   { job }),
    tailor:    (job)             => req('POST', '/api/jobs/tailor',     { job }),
    applicationPacket: (job) => req('POST', '/api/jobs/application-packet', { job }),
    recommend: (job)             => req('POST', '/api/jobs/recommend',  { job }),
    moreLike:       (jobId, existing) => req('POST', '/api/jobs/more-like',  { jobId, existing }),
    salaryEstimate: (job)             => req('POST', '/api/jobs/salary-estimate', { job }),

    async search(params) {
      const { searchId } = await req('POST', '/api/jobs/search', params);
      return searchId;
    },

    stream(searchId, { onJob, onUpdate, onStatus, onDone, onError } = {}) {
      const es = new EventSource(`/api/jobs/stream/${searchId}`);
      es.addEventListener('job',    e => onJob?.(JSON.parse(e.data)));
      es.addEventListener('update', e => onUpdate?.(JSON.parse(e.data)));
      es.addEventListener('status', e => onStatus?.(JSON.parse(e.data)));
      es.addEventListener('done',   e => { const d = JSON.parse(e.data); if (d.error) onError?.(d.error); else onDone?.(); es.close(); });
      es.onerror = () => { onError?.('Connection error'); es.close(); };
      return () => es.close();
    },
  },

  tracker: {
    list:        ()         => req('GET',    '/api/tracker'),
    add:         (entry)    => req('POST',   '/api/tracker', entry),
    update:      (id, data) => req('PATCH',  `/api/tracker/${id}`, data),
    remove:      (id)       => req('DELETE', `/api/tracker/${id}`),
    exportPdf:   ()         => { window.open('/api/tracker/export/pdf',  '_blank'); },
    exportDocx:  ()         => { window.open('/api/tracker/export/docx', '_blank'); },
  },

  outreach: {
    linkedinRequest: (job, contactName)             => req('POST', '/api/outreach/linkedin-request', { job, contactName }),
    coldEmail:       (job, contactName, contactRole) => req('POST', '/api/outreach/cold-email',       { job, contactName, contactRole }),
    referralAsk:     (job, contactName, relationship) => req('POST', '/api/outreach/referral-ask',    { job, contactName, relationship }),
    followup:        (job, applicationDate)          => req('POST', '/api/outreach/followup',         { job, applicationDate }),
  },

  interview: {
    starAnswers:  (job, questions) => req('POST', '/api/interview/star-answers',  { job, questions }),
    companyBrief: (job)            => req('POST', '/api/interview/company-brief', { job }),
    techQA:       (job)            => req('POST', '/api/interview/tech-qa',       { job }),
    mockFeedback: (job, question, answer) => req('POST', '/api/interview/mock-feedback', { job, question, answer }),
  },

  analytics: {
    pipeline:   ()     => req('GET',  '/api/analytics/pipeline'),
    skillsGap:  (jobs) => req('POST', '/api/analytics/skills-gap',  { jobs }),
    blindSpots: ()     => req('POST', '/api/analytics/blind-spots',  {}),
  },

  company: {
    intel: (job) => req('POST', '/api/company/intel', { job }),
  },

  offers: {
    analyze:   (offer, job)              => req('POST', '/api/offers/analyze',   { offer, job }),
    negotiate: (offer, job, targetComp)  => req('POST', '/api/offers/negotiate', { offer, job, targetComp }),
  },

  contacts: {
    list:     ()           => req('GET',    '/api/contacts'),
    add:      (data)       => req('POST',   '/api/contacts', data),
    update:   (id, patch)  => req('PATCH',  `/api/contacts/${id}`, patch),
    remove:   (id)         => req('DELETE', `/api/contacts/${id}`),
    outreach: (id, job, type) => req('POST', `/api/contacts/${id}/outreach`, { job, type }),
  },

  alerts: {
    list:   ()         => req('GET',    '/api/alerts'),
    add:    (data)     => req('POST',   '/api/alerts', data),
    update: (id, data) => req('PATCH',  `/api/alerts/${id}`, data),
    remove: (id)       => req('DELETE', `/api/alerts/${id}`),
  },

  resumeVersions: {
    list:      ()           => req('GET',    '/api/resume-versions'),
    add:       (data)       => req('POST',   '/api/resume-versions', data),
    update:    (id, data)   => req('PATCH',  `/api/resume-versions/${id}`, data),
    remove:    (id)         => req('DELETE', `/api/resume-versions/${id}`),
    setActive: (id)         => req('POST',   `/api/resume-versions/${id}/set-active`, {}),
  },

  export: {
    csv() { window.open('/api/export/csv', '_blank'); },
  },

  sessions: {
    list:       ()             => req('GET',    '/api/sessions'),
    active:     ()             => req('GET',    '/api/sessions/active'),
    save:       (name)         => req('POST',   '/api/sessions',              { name }),
    autosave:   ()             => req('POST',   '/api/sessions/autosave'),
    newSession: (name, opts)   => req('POST',   '/api/sessions/new',          { name, ...opts }),
    load:       (id)           => req('POST',   `/api/sessions/${id}/load`),
    rename:     (id, name)     => req('POST',   `/api/sessions/${id}/rename`, { name }),
    remove:     (id)           => req('DELETE', `/api/sessions/${id}`),
  },

  platforms: {
    status:     ()             => req('GET',    '/api/platforms/status'),
    connect:    (name)         => req('POST',   `/api/platforms/${name}/connect`),
    disconnect: (name)         => req('DELETE', `/api/platforms/${name}`),
    sync:       (name, profileUrl) => req('POST', `/api/platforms/${name}/sync`, profileUrl ? { profileUrl } : undefined),
  },

  appWriter: {
    answer: (data) => req('POST', '/api/app-writer/answer', data),
  },
};
