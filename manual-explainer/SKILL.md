---
name: manual-explainer
description: Turn a user's manual / instruction document (PPT/PPTX, Word DOC/DOCX or PDF) into an interactive explainer app — a narrated, step-by-step lesson in Chinese, Korean and English (switchable in the app) built from the manual's own pages, with voice playback, chapter quizzes and an "interrupt & ask" button that pauses the lesson, answers questions from the manual with page citations, then resumes where it stopped. It can also export the lesson as an editable PowerPoint deck with the narration (on the slides and as speaker notes). Use whenever the user uploads or links a manual, 说明书, 操作手册, 使用说明, 培训资料, SOP, 매뉴얼, 사용설명서, 교육자료 or instruction deck and wants it explained, taught, walked through, turned into a 讲解/教学/培训 app, 讲解视频-like tool, tutorial or training page — even if they don't say "app" (e.g. "帮我讲解一下这个说明书", "把这个手册做成可以提问的教学", "이 매뉴얼 설명해주는 앱 만들어줘", "walk me through this manual"), and to export such a lesson as PPT ("导出PPT", "PPT로 내보내기").
---

# Manual Explainer

Build a self-contained HTML "lesson app" from a manual:
pages are shown as images, each step is narrated in Chinese, Korean or English — switchable any time (browser
text-to-speech, with sentence highlighting), and the learner can press **✋ 打断提问** at any moment.
That pauses the narration mid-sentence, opens a question panel that knows where
the learner is, answers from the manual with `[p.N]` page links, and
**▶ 继续讲解** resumes from the interrupted sentence.

The quality of the app depends almost entirely on step 2 (understanding) and
step 3 (lesson design). The scripts handle the mechanics.

## Environments

Paths below are the claude.ai ones (`/mnt/user-data/uploads` for the user's file,
`/home/claude/mx` as a work folder, `/mnt/user-data/outputs` for results). In Claude Code,
Cursor or another agent, use the path of the user's file, any scratch folder (e.g. `./mx`)
and an output folder in the project; everything else is the same. Requirements: Python 3 with
python-pptx, python-docx, pdfplumber, Pillow; LibreOffice (`soffice`) and Poppler
(`pdftoppm`); Node.js with pptxgenjs for the PowerPoint export.

## Workflow

### 1. Extract

```bash
SK=<this skill's directory>
python $SK/scripts/extract_manual.py "/mnt/user-data/uploads/<file>" /home/claude/mx
```

Supports pdf, pptx, ppt, docx, doc (everything goes through a PDF so page
numbers match the images). Output in `/home/claude/mx`: `content.md` (full
text with `[[pN]]` markers, pptx speaker notes, docx heading outline),
`content.json`, `pages/pN.jpg`. The printed report lists `image_heavy_pages`
and how many secrets were masked.

For PPTX slides that are one large picture with notes in a text box beside it,
the extractor uses the picture itself at native resolution as the page image
(reported in `warnings`), so slides show bigger and sharper.

If no file is attached, ask for it. If the file is a scanned PDF with no text
(`total_chars` near 0), read the page images visually and write `knowledge`
yourself from what you see.

### 2. Understand the manual fully — before designing anything

Read `content.md` from start to end (in chunks with `view` if long). Then
`view` the page images for every `image_heavy` page and for any page whose text
refers to a figure, screen, panel, wiring diagram, table or button layout —
those visuals are often the heart of a manual and text extraction misses them.

Build a working model and keep notes in `/home/claude/mx/notes.md`:
- what the product/process is, who the reader is, what they must be able to do afterwards
- the real structure: setup → normal operation → settings → maintenance → troubleshooting, or whatever the manual actually uses
- every procedure with its order, preconditions and expected result
- every warning / caution / danger notice (these must survive into the lesson word-for-word in meaning)
- specs and numbers (pressures, voltages, timings, limits) and on which page
- terms the learner must know (→ glossary)
- contradictions, gaps or unclear points — mention these to the user at the end rather than guessing

### 3. Design the lesson → `/home/claude/mx/lesson.json`

Read `references/lesson_schema.md` for the exact format and narration rules.
Design principles:
- **Teach, don't read aloud.** Order by what the learner needs first, not
  necessarily by page order. Typical size: 3–10 chapters, 2–8 steps each, one idea per step.
- Each step shows the most relevant page image (`image`) and lists every
  supporting page in `page_refs`.
- Narration explains *why* and *what goes wrong*, points at what is visible on
  the page image, and is written to be spoken.
- Carry every safety warning into `warning` of the step where it applies.
- 1–3 quiz questions per chapter on things that matter in practice
  (procedure order, limits, warnings) — not trivia.
- `knowledge` = the cleaned full text of `content.md` with its `[[pN]]`
  markers (drop page headers/footers and repeated boilerplate; keep tables).
  Add a short description of important figures you saw on image-heavy pages
  under their page marker, so the tutor can answer about them too.
- **Coverage check:** every page should appear in some step's `image` or
  `page_refs`, except cover, table of contents, blank and legal pages. The
  build report prints `uncovered_pages`; fix gaps that carry real content.
- **Languages (default: 中文 / 한국어 / English):** build every lesson in
  all three — `"languages": ["zh","ko","en"]` — so the learner can switch in
  the app's header at any time. Set `language` (the default) to the language
  the user is talking to you in. Only build fewer languages when the user asks.
  Every visible text (titles, narration, bullets, warnings, quiz, glossary) is
  then a `{"zh":…,"ko":…,"en":…}` object; the build refuses to run if one is
  missing. Write each language natively for speaking, not as a literal
  translation of the other two, and keep warnings equally strict in all of them.
  `knowledge` stays in the manual's original language — the tutor reads it and
  answers in whichever language is selected.
  Keep the manual's original on-screen labels (button names, alarm codes) the
  first time they appear in every language.
- For long manuals, write the lesson in the default language first, check
  coverage, then add the other two languages field by field.

### 4. Build

```bash
python $SK/scripts/build_app.py /home/claude/mx/lesson.json /home/claude/mx /mnt/user-data/outputs/<name>-讲解.html
```

The build validates the lesson (fix and rerun on `LESSON ERROR`), masks
secrets again, embeds page images within a ~14.5 MiB budget (published pages
must stay under 16 MB), and prints a report. Images are WebP and identical pages are stored once. Step images are always embedded
and kept sharpest (up to 1800px, never upscaled); pages listed only in `page_refs` are embedded smaller, and
any that do not fit appear as text-only citations. For very long manuals
(hundreds of pages) keep step images to distinct, essential pages.
Credentials that appear inside page images (screenshots, slide text) are not
caught by the text scan: black them out in `pages/pN.jpg` before building.
Do not hand-edit the template's logic for a single manual; change `lesson.json`.

### 5. Deliver

- **Where the Artifact tool exists (claude.ai):** publish the HTML with
  `capabilities: {"sample": {}}` and favicon 📘. `sample` is what lets the
  in-app tutor ask Claude. Do not declare other capabilities.
- **Elsewhere (Claude Code, Cowork, no Artifact tool):** present the HTML file.
  Opened as a plain file, the ask panel falls back to searching the manual and
  showing the most relevant original passages with page numbers.

Then reply briefly, in the user's language: the chapter list in one or two
lines, how to use it (▶ play, ✋ interrupt anytime, keyboard: Space / ← → / Q),
that the first question asks permission to use their Claude usage, and any
gaps or contradictions you found in the manual.

### 6. Export to PowerPoint (when asked)

When the user wants the lesson as a PPT/PPTX ("导出为PPT", "PPT로 만들어줘", "加上讲解内容"),
export the same `lesson.json` — never write a second version of the content:

```bash
node $SK/scripts/export_pptx.js /home/claude/mx/lesson.json /home/claude/mx /mnt/user-data/outputs/<name>.pptx [--lang zh|ko|en] [--narration both|notes]
```

- Deck: title → contents → per chapter a divider, one slide per step (page image left, key
  points + warning + page references right, the narration under the image) and a quiz slide
  → glossary table. Every step's narration is also the slide's **speaker notes** (plus warning
  and page refs), so a trainer can present it directly; quiz answers and explanations are in
  the quiz slide's notes. One PowerPoint section per chapter.
- `--narration notes` keeps the narration only in the notes (bigger page images) — use it
  when the user wants clean slides for presenting. Default `both`.
- `--lang` picks one language of a multi-language lesson (default: the lesson's default);
  export each language separately if they want several.
- Every text sits inside its own filled shape (no loose text box laid over a shape), fonts
  are Microsoft YaHei / Malgun Gothic / Calibri by language, LAYOUT_WIDE 16:9, folder
  entries are stripped from the ZIP so SharePoint/OneDrive open it.
- Needs `pptxgenjs` (Node). If the pptx skill is available, read its SKILL.md first, then
  validate with its `scripts/office/validate.py` and render a few slides for a visual check.
- Deliver the .pptx with present_files (it is a download, not a published page).

### 7. Iterate

For changes ("第3章讲细一点", "语速太快", "加一章故障排除"), edit
`lesson.json`, rebuild, and republish to the same artifact (pass its `url`).

## Security (company documents)

Manuals can contain account names, default passwords, IPs with credentials,
license keys or customer data.
- Both scripts mask passwords, tokens, keys, private keys and credentialed
  connection strings automatically. Never copy such values into narration,
  bullets or your replies; report only *that* N items were masked and of which kind.
- If a manual's default credential is genuinely part of a procedure (e.g. "log
  in as admin with the initial password"), describe the step and point to the
  page ("初始密码见手册第12页，或向管理员获取") instead of stating the value.
- Do not upload the manual to any external service; everything runs locally
  and in the published page.

## What the app does (for answering user questions about it)

- Header: title, language switcher (中文 / 한국어 / EN — switching keeps the current step and works mid-lesson or inside the ask panel), 🔊 voice panel, speed 0.8–1.5×; progress bar.
- Voice: the app ranks the browser's voices and picks the most natural one automatically (Edge “Natural/Online” neural voices > Apple Enhanced/Premium > Google voices > others). The 🔊 panel lists them (★ = natural), offers a preview and remembers the choice per language. When only robotic voices exist it says so and suggests Edge / a Google voice / downloading an enhanced voice. Pre-recorded audio is not possible: a published page cannot call a TTS service and audio would exceed the size limit.
- Contents drawer (☰ on mobile): chapters, steps (visited ones marked), quizzes, glossary.
- Step card: page image, title, key points, warning, narration with the current sentence highlighted, page chips.
- 🖼 large-slide mode (default on): contents move into the ☰ drawer and the slide fills the screen height next to a narrow text column (stacked on narrow screens). Toggle and remembered per viewer.
- Page viewer (tap a slide, page chip or [p.N] link): pinch / mouse-wheel zoom up to 6×, drag to pan, double-tap to zoom, − ⤢ + buttons, ‹ › to flip through every embedded page; keyboard + − 0 ← → Esc. On a portrait phone it suggests turning the phone sideways.
- Autoplay continues across steps and stops at each chapter quiz.
- ✋ ask panel: context line showing the current position, suggestion chips
  (再讲一遍 / 更简单 / 举例 / 为什么重要 / 常见错误), streaming answers with clickable `[p.N]`,
  Stop button, ▶ 继续讲解 resumes from the interrupted sentence.
- Position, voice and speed are remembered per viewer.
- Voices depend on the viewer's browser/OS; without a matching voice the app
  still advances by reading time with highlighting.
