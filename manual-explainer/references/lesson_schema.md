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
  "language": "zh",
  "title": {"zh": "XR-200 操作讲解", "ko": "XR-200 조작 설명", "en": "XR-200 Operation Guide"},
  "chapters": [{
    "title": {"zh": "开机准备", "ko": "전원 투입 준비", "en": "Power-on preparation"},
    "steps": [{
      "image": 5, "page_refs": [5, 6],
      "title": {"zh": "上电前检查", "ko": "전원 투입 전 점검", "en": "Pre-power check"},
      "bullets": {"zh": ["急停已复位"], "ko": ["비상정지 해제 확인"], "en": ["E-stop released"]},
      "warning": {"zh": "…", "ko": "…", "en": "…"},
      "narration": {"zh": "…", "ko": "…", "en": "…"}
    }],
    "quiz": [{"q": {"zh": "…", "ko": "…", "en": "…"},
              "options": {"zh": ["…", "…"], "ko": ["…", "…"], "en": ["…", "…"]},
              "answer": 1,
              "explain": {"zh": "…", "ko": "…", "en": "…"}}]
  }],
  "glossary": [{"term": {"zh": "原点复归", "ko": "원점 복귀", "en": "Homing"},
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
  "title": "XX设备 操作说明 讲解",
  "subtitle": "基于《XX操作手册 v2.1》",
  "language": "zh",
  "chapters": [
    {
      "title": "开机与初始化",
      "summary": "一句话说明本章学完能做什么",
      "steps": [
        {
          "id": "c1s1",
          "title": "上电前检查",
          "image": 5,
          "page_refs": [5, 6],
          "bullets": ["确认急停按钮已复位", "确认气压 0.5–0.7 MPa"],
          "warning": "未确认气压就上电会导致夹爪误动作。",
          "narration": "开机之前，先做两件事。第一，看一下急停按钮……"
        }
      ],
      "quiz": [
        {
          "q": "上电前气压应在什么范围？",
          "options": ["0.2–0.3 MPa", "0.5–0.7 MPa", "1.0 MPa 以上"],
          "answer": 1,
          "explain": "手册第5页规定 0.5–0.7 MPa。"
        }
      ]
    }
  ],
  "glossary": [{"term": "原点复归", "def": "让各轴回到机械零点的动作"}],
  "knowledge": "[[p1]]\n第1页清理后的全文……\n[[p2]]\n第2页……"
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
| `steps[].title` | yes | Short, action-shaped ("连接气管", not "关于气管"). |
| `steps[].narration` | yes | Spoken script. Split into sentences for TTS and highlighting, so use full sentence punctuation (。！？ or . ! ?). |
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
- Spell out symbols the voice reads badly: "0.5到0.7兆帕" rather than "0.5–0.7MPa" inside narration (bullets may keep the symbols).
- Refer to what is on the shown page image ("右上角红色的那个按钮") so listening and looking line up.
- When the manual's language differs from `language`, explain in `language` and keep the manual's exact UI labels/button names in the original, in quotes or parentheses, the first time they appear — the learner will see those labels on the real screen.
