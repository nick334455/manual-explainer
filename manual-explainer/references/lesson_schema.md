# lesson.json — the data the explainer app runs on

## Multi-language (default)

Add `"languages": ["zh","ko","en"]` and make every visible text a
`{"zh": …, "ko": …, "en": …}` object (lists such as `bullets` and quiz
`options` become `{"zh": [...], "ko": [...], "en": [...]}`). Numbers, `image`,
`page_refs`, `answer`, `id` and `knowledge` stay plain. `language` is the
default shown first. `build_app.py` lists every field missing a language.

```json
{
  "languages": ["zh", "ko", "en"],
  "language": "en",
  "title": {"zh": "…", "ko": "…", "en": "XR-200 Operation Guide"},
  "chapters": [{
    "title": {"zh": "…", "ko": "…", "en": "Power-on preparation"},
    "steps": [{
      "image": 5, "page_refs": [5, 6],
      "title": {"zh": "…", "ko": "…", "en": "Pre-power check"},
      "bullets": {"zh": ["…"], "ko": ["…"], "en": ["E-stop released"]},
      "warning": {"zh": "…", "ko": "…", "en": "…"},
      "narration": {"zh": "…", "ko": "…", "en": "…"}
    }],
    "quiz": [{"q": {"zh": "…", "ko": "…", "en": "…"},
              "options": {"zh": ["…", "…"], "ko": ["…", "…"], "en": ["…", "…"]},
              "answer": 1,
              "explain": {"zh": "…", "ko": "…", "en": "…"}}]
  }],
  "glossary": [{"term": {"zh": "…", "ko": "…", "en": "Homing"},
                "def": {"zh": "…", "ko": "…", "en": "…"}}],
  "knowledge": "[[p1]]\n…original-language text…"
}
```

Option order must be the same in every language (`answer` is shared).

## Single language

The plain-string form below is still accepted when `languages` is absent.

`build_app.py` validates this file and refuses to build if a required field is
missing. Page numbers are 1-based and refer to `content.json` / `pages/pN.jpg`.

```json
{
  "title": "XX Machine Operation Guide",
  "subtitle": "Based on the XX Operation Manual v2.1",
  "language": "en",
  "chapters": [
    {
      "title": "Power-on and initialization",
      "summary": "One sentence on what the learner can do after this chapter",
      "steps": [
        {
          "id": "c1s1",
          "title": "Check before power-on",
          "image": 5,
          "page_refs": [5, 6],
          "bullets": ["E-stop button released", "Air pressure 0.5–0.7 MPa"],
          "warning": "Powering on without the right air pressure can make the gripper misfire.",
          "narration": "Before you switch on, check two things. First, look at the emergency stop button……"
        }
      ],
      "quiz": [
        {
          "q": "What air pressure is required before power-on?",
          "options": ["0.2–0.3 MPa", "0.5–0.7 MPa", "Above 1.0 MPa"],
          "answer": 1,
          "explain": "Page 5 of the manual specifies 0.5–0.7 MPa."
        }
      ]
    }
  ],
  "glossary": [{"term": "Homing", "def": "Moving every axis back to its mechanical zero"}],
  "knowledge": "[[p1]]\nCleaned full text of page 1……\n[[p2]]\nPage 2……"
}
```

## Field rules

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Shown in the header and browser tab. |
| `languages` | default | `["zh","ko","en"]`; enables the header switcher. |
| `language` | yes | Default language shown first: `zh`, `ko`, `en` or `ja`. Drives UI labels, the voice, and the answer language. |
| `chapters[].title` | yes | |
| `chapters[].steps[]` | yes, ≥1 | One idea per step. |
| `steps[].title` | yes | Short, action-shaped ("Connect the air hose", not "About the air hose"). |
| `steps[].narration` | yes | Spoken script. Split into sentences for TTS and highlighting, so use full sentence punctuation (. ! ? or the equivalent CJK marks). |
| `steps[].image` | no | Integer page number whose image is shown next to the step. |
| `steps[].page_refs` | no | Integers; shown as tappable page chips and used to bias Q&A retrieval. |
| `steps[].bullets` | no | 2–4 short key points the eye can scan while listening. |
| `steps[].warning` | no | Copy safety/caution content faithfully; never soften it. |
| `steps[].id` | no | Auto-filled as `c{chapter}s{step}` when omitted. |
| `chapters[].quiz[]` | no | `answer` is the 0-based index into `options`. Shown as its own item after the chapter's last step; autoplay stops there. |
| `glossary[]` | no | Shown at the bottom of the contents drawer. |
| `knowledge` | yes | The Q&A corpus: the manual's full text, cleaned, with `[[pN]]` markers. The in-app tutor answers only from this and cites `[p.N]`. Up to ~150 000 characters are sent whole; beyond that the app sends the most relevant pages per question. |

## Writing the narration

- Speak, don't recite: explain what to do, why it matters and what goes wrong if skipped. The manual text itself is on the page image and in `knowledge`.
- Chinese/Korean/Japanese: about 60–220 characters per step. English: about 40–140 words.
- Spell out symbols the voice reads badly: "0.5 to 0.7 megapascals" rather than "0.5–0.7MPa" inside narration (bullets may keep the symbols).
- Refer to what is on the shown page image ("the red button in the top-right corner") so listening and looking line up.
- When the manual's language differs from `language`, explain in `language` and keep the manual's exact UI labels/button names in the original, in quotes or parentheses, the first time they appear — the learner will see those labels on the real screen.
