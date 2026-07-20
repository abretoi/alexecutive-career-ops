#!/usr/bin/env bash
# Alexecutive Career Ops — first-time setup
# Creates empty data files so the app starts clean, then installs dependencies.

set -e
cd "$(dirname "$0")/.."

echo "==> Installing Node dependencies…"
npm install

echo "==> Creating data directory…"
mkdir -p data/sessions data/platform-sessions

# Initialise empty JSON stores only if they don't already exist
init_json() {
  local file="$1"
  local content="$2"
  if [ ! -f "data/$file" ]; then
    echo "$content" > "data/$file"
    echo "    created data/$file"
  fi
}

init_json "config.json"          '{"aiProvider":"anthropic","aiApiKey":"","aiFastModel":"claude-haiku-4-5-20251001","aiPowerModel":"claude-sonnet-4-6"}'
init_json "profile.json"         '{}'
init_json "resume.json"          '{}'
init_json "applications.json"    '[]'
init_json "contacts.json"        '[]'
init_json "alerts.json"          '[]'
init_json "resume-versions.json" '[]'
init_json "cover-letter.json"    '{}'
init_json "writing-style.json"   '{"style":"professional"}'

echo ""
echo "==> Optional: install Python JobSpy for LinkedIn/Indeed search"
echo "    pip install python-jobspy"
echo ""
echo "==> Start the app:"
echo "    npm start          # http://localhost:3000"
echo "    npm run dev        # auto-restart on changes"
echo ""
echo "Done. Open http://localhost:3000 and configure your AI provider in Settings."
