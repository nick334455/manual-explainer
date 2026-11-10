# manual-explainer

설명서(PPT/PPTX, Word DOC/DOCX, PDF)를 **음성 강의 + 중간 질문이 가능한 인터랙티브 앱**으로 만들어 주는 Claude Skill입니다.

## 기능
- **단계별 음성 강의**: 원본 페이지 이미지 + 핵심 요약 + 말하듯 쓴 설명, 현재 문장 하이라이트
- **✋ 중간 질문**: 강의를 즉시 멈추고, 현재 위치를 아는 상태로 매뉴얼 근거(`[p.N]` 페이지 링크)로 답변, ▶ 계속하기로 멈춘 문장부터 재개
- **다국어**: 한국어·중국어·영어 동시 생성, 앱에서 언제든 전환 (단일 언어도 가능)
- **자연스러운 음성**: 브라우저의 고품질 음성(Edge Natural, Apple 향상된 음성, Google)을 자동 선택, 직접 선택·미리 듣기
- **슬라이드 크게 보기 + 확대 뷰어**: 화면 높이에 맞춘 슬라이드, 핀치/휠 확대(최대 6배)·끌어 이동·페이지 넘기기
- **챕터 퀴즈, 용어집, 진행 위치 기억**
- **보안**: 비밀번호·토큰·키·접속 문자열 자동 마스킹 (이미지 속 정보는 작업 시 수동 가림)

## 구성
```
manual-explainer/
├── SKILL.md                    # 스킬 지침 (워크플로·설계 원칙·보안)
├── scripts/
│   ├── extract_manual.py       # 문서 → 페이지 텍스트·이미지 추출 (LibreOffice, pdfplumber)
│   ├── build_app.py            # lesson.json + 이미지 → 단일 HTML 앱 (검증·마스킹·WebP 임베드)
│   └── secrets_scan.py         # 민감정보 탐지·마스킹
├── assets/template.html        # 앱 템플릿
└── references/lesson_schema.md # lesson.json 형식
```

## 설치
- **claude.ai**: Releases의 `manual-explainer.skill` 또는 `manual-explainer` 폴더를 zip으로 묶어 Customize › Skills › 업로드
- **Claude Code**: `manual-explainer` 폴더를 `~/.claude/skills/` (또는 프로젝트의 `.claude/skills/`)에 복사

## 사용
설명서를 올리고 예: "이 매뉴얼 설명해주는 앱 만들어줘", "帮我讲解这个说明书", "walk me through this manual"

## 요구 사항 (스크립트 실행 환경)
Python 3, `python-pptx`, `python-docx`, `pdfplumber`, `Pillow`(WebP 지원), LibreOffice(`soffice`), Poppler(`pdftoppm`)

## 주의
- 회사 매뉴얼·생성된 강의 HTML은 이 저장소에 올리지 마세요 (`.gitignore`로 제외).
