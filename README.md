# manual-explainer

**Turn a PPT, Word or PDF manual into a narrated, step-by-step explainer app — and stop it at any moment to ask a question.**

A skill (SKILL.md) for Claude and other AI agents. Give it a manual; it reads the whole document, designs a lesson and builds a single self-contained HTML app. Optionally it exports the same lesson as an editable PowerPoint deck with the narration as speaker notes.

## Features
- **Narrated lesson** built from the manual's own pages: page image, key points, safety warnings, spoken explanation with sentence highlighting
- **✋ Interrupt & ask**: pauses mid-sentence, answers from the manual with clickable `[p.N]` page links, then resumes where it stopped (AI answers on claude.ai; offline search of the manual elsewhere)
- **Chinese / Korean / English**, switchable in the app (or a single language)
- **Natural voices**: picks the best voice the browser has (Edge “Natural”, Apple Enhanced, Google), selectable with preview
- **Large-slide view + zoom viewer**: pinch / wheel zoom up to 6×, drag, flip through every page
- Chapter quizzes, glossary, remembers progress
- **PowerPoint export**: title, contents, chapter dividers, one slide per step, quiz (answers in notes), glossary
- **Security**: masks passwords, tokens, keys and credentialed connection strings found in the text

## Install
- **claude.ai**: download `manual-explainer.skill` from Releases (or zip the `manual-explainer` folder) → Customize › Skills › upload
- **Claude Code**: copy `manual-explainer/` into `~/.claude/skills/` (or a project's `.claude/skills/`)
- **Other agents that read SKILL.md**: place the folder where your agent loads skills

## Use
Attach a manual and ask, for example:
- “Turn this manual into an explainer app”
- “Walk me through this manual so I can ask questions” (requests in any language work)
- then “Export it as PPT with the narration”

## Requirements
Python 3 with `python-pptx`, `python-docx`, `pdfplumber`, `Pillow` (with WebP) · LibreOffice (`soffice`) · Poppler (`pdftoppm`) · Node.js with `pptxgenjs` (PowerPoint export only)

## Repository layout
```
manual-explainer/
├── SKILL.md                     # agent instructions: workflow, lesson design, security
├── scripts/
│   ├── extract_manual.py        # document → page text + page images
│   ├── build_app.py             # lesson.json + images → one HTML app
│   ├── export_pptx.js           # lesson.json + images → PowerPoint
│   └── secrets_scan.py          # credential masking
├── assets/template.html         # the app
└── references/lesson_schema.md  # lesson.json format
```

## License
Free to use — © 2026 nick (nick334455). Anyone may use and modify it for their own work or inside their organization at no cost; redistribution, resale or re-listing elsewhere is not permitted. See [LICENSE](LICENSE).
Third-party tools and their licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Notes
- Do not commit manuals or generated apps to this repository (`.gitignore` blocks them).
