# Third-party notices

manual-explainer does **not** bundle or redistribute any third-party code.
Its scripts call the following tools, which the user installs separately.
Each remains under its own license.

| Component | Used for | License | Project |
|---|---|---|---|
| python-pptx | Reading PPTX slides, notes and embedded pictures | MIT | https://github.com/scanny/python-pptx |
| python-docx | Reading Word heading outlines | MIT | https://github.com/python-openxml/python-docx |
| pdfplumber (with pdfminer.six) | Extracting page text and tables | MIT | https://github.com/jsvine/pdfplumber |
| Pillow | Resizing / encoding page images | MIT-CMU (HPND) | https://github.com/python-pillow/Pillow |
| PptxGenJS | Writing the PowerPoint export | MIT | https://github.com/gitbrent/PptxGenJS |
| JSZip | Cleaning the PPTX package (via PptxGenJS) | MIT or GPL-3.0-or-later (used under MIT) | https://github.com/Stuk/jszip |
| LibreOffice | Converting PPT/PPTX/DOC/DOCX to PDF (run as a separate program) | MPL-2.0 | https://www.libreoffice.org |
| Poppler (`pdftoppm`) | Rendering PDF pages to images (run as a separate program) | GPL-2.0 / GPL-3.0 | https://poppler.freedesktop.org |

LibreOffice and Poppler are invoked as external command-line programs; no part of
them is linked into or shipped with this skill.

The generated explainer apps use the viewer's own browser features (Web Speech API
text-to-speech) and, on claude.ai, the Claude runtime for in-app questions. They
contain no third-party code.

"Claude" is a trademark of Anthropic. This project is not affiliated with or endorsed
by Anthropic.

## Your manuals

The skill processes documents you provide. Rights to those documents and to the
explainer apps / decks generated from them stay with their owners; make sure you are
allowed to share them before distributing the output.
