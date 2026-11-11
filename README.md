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
- “帮我讲解一下这个说明书” / “이 매뉴얼 설명해주는 앱 만들어줘”
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
Proprietary — © 2026 김세휘 (nick334455). All rights reserved. Use requires a license obtained through an authorized channel; redistribution or resale is not permitted. See [LICENSE](LICENSE).
Third-party tools and their licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Notes
- Do not commit manuals or generated apps to this repository (`.gitignore` blocks them).

---

## 한국어 요약
설명서(PPT·Word·PDF)를 **음성 강의 + 중간 질문이 가능한 앱**으로 만들고, 같은 내용을 **설명 대본이 들어간 PPT**로도 내보내는 스킬입니다. 한국어·중국어·영어 전환, 자연스러운 음성 자동 선택, 슬라이드 확대 뷰어, 퀴즈·용어집, 민감정보 자동 마스킹을 지원합니다. 설치·사용법과 요구 사항은 위 영문 설명을 참고하세요. 이 스킬은 저작권자 소유이며(All rights reserved), 정식 경로로 라이선스를 받은 경우에만 사용할 수 있고 재배포·재판매는 허용되지 않습니다.
