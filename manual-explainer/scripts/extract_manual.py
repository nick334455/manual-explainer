#!/usr/bin/env python3
"""Extract a manual (pdf / pptx / ppt / docx / doc) into page text + page images.

Usage:
    python extract_manual.py <input_file> <work_dir> [--width 1400]

Writes into <work_dir>:
    pages/p1.jpg, p2.jpg, ...   one rendered image per page/slide
    content.json                structured per-page data (text, notes, flags)
    content.md                  the whole manual as readable text with [[pN]] page markers

Everything is first converted to PDF (LibreOffice) so that page numbers,
images and text line up the same way for every format. For pptx the speaker
notes are added per slide; for docx the heading outline is added.
Secrets found in the text are masked in content.md / content.json and only
counted in the report (values are never printed).
"""
import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from secrets_scan import mask_text  # noqa: E402


def run(cmd, timeout=900):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=timeout)


def to_pdf(src, outdir):
    ext = os.path.splitext(src)[1].lower()
    if ext == ".pdf":
        dst = os.path.join(outdir, "source.pdf")
        shutil.copy(src, dst)
        return dst
    tmp = os.path.join(outdir, "_convert")
    os.makedirs(tmp, exist_ok=True)
    run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmp, src])
    pdfs = glob.glob(os.path.join(tmp, "*.pdf"))
    if not pdfs:
        raise SystemExit("LibreOffice could not convert the file to PDF")
    dst = os.path.join(outdir, "source.pdf")
    shutil.move(pdfs[0], dst)
    shutil.rmtree(tmp, ignore_errors=True)
    return dst


def render_pages(pdf, outdir, width):
    pdir = os.path.join(outdir, "pages")
    os.makedirs(pdir, exist_ok=True)
    run(["pdftoppm", "-jpeg", "-jpegopt", "quality=82", "-scale-to-x", str(width),
         "-scale-to-y", "-1", pdf, os.path.join(pdir, "raw")])
    files = sorted(glob.glob(os.path.join(pdir, "raw-*.jpg")),
                   key=lambda p: int(re.search(r"-(\d+)\.jpg$", p).group(1)))
    for f in files:
        n = int(re.search(r"-(\d+)\.jpg$", f).group(1))
        os.replace(f, os.path.join(pdir, f"p{n}.jpg"))
    return len(files)


def pdf_page_texts(pdf):
    import pdfplumber
    texts = []
    with pdfplumber.open(pdf) as doc:
        for page in doc.pages:
            t = page.extract_text() or ""
            try:
                for table in page.extract_tables() or []:
                    rows = [" | ".join((c or "").strip() for c in row) for row in table if row]
                    if rows:
                        t += "\n[TABLE]\n" + "\n".join(rows) + "\n[/TABLE]"
            except Exception:
                pass
            texts.append(t.strip())
    return texts


def pptx_notes(src):
    try:
        from pptx import Presentation
    except ImportError:
        return [], []
    prs = Presentation(src)
    notes, hidden = [], []
    for slide in prs.slides:
        n = ""
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame is not None:
            n = slide.notes_slide.notes_text_frame.text.strip()
        notes.append(n)
        hidden.append(slide._element.get("show") == "0")
    return notes, hidden


def pptx_native_pictures(src, pdir, rendered_width, hidden):
    """Slides that are essentially one large picture (a screenshot of an older slide, with
    notes in a text box beside it): replace the rendered page with the picture itself at
    its native resolution, so the app can show and zoom it sharper and without the empty
    margins. Only done when no other shape overlaps the picture (overlays would be lost)."""
    try:
        from pptx import Presentation
        from PIL import Image
        import io
    except ImportError:
        return []
    prs = Presentation(src)
    sw, sh = prs.slide_width, prs.slide_height
    done, page = [], 0
    for slide, hid in zip(prs.slides, hidden or [False] * len(prs.slides)):
        if hid:
            continue
        page += 1
        pics = [x for x in slide.shapes if x.shape_type == 13]
        if len(pics) != 1:
            continue
        pic = pics[0]
        if pic.width * pic.height < 0.35 * sw * sh:
            continue
        def overlaps(a, b):
            return not (a.left + a.width <= b.left or b.left + b.width <= a.left or
                        a.top + a.height <= b.top or b.top + b.height <= a.top)
        if any(x.shape_id != pic.shape_id and x.width and overlaps(x, pic) for x in slide.shapes):
            continue
        try:
            im = Image.open(io.BytesIO(pic.image.blob)).convert("RGB")
        except Exception:
            continue
        if im.width < rendered_width * 0.6:
            continue  # the rendered page is sharper
        im.save(os.path.join(pdir, f"p{page}.jpg"), quality=93)
        done.append(page)
    return done


def docx_outline(src):
    try:
        import docx
    except ImportError:
        return []
    d = docx.Document(src)
    out = []
    for p in d.paragraphs:
        style = (p.style.name or "") if p.style is not None else ""
        m = re.match(r"(?i)(heading|标题|제목)\s*(\d)", style)
        if m and p.text.strip():
            out.append({"level": int(m.group(2)), "text": p.text.strip()})
        elif style.lower() == "title" and p.text.strip():
            out.append({"level": 0, "text": p.text.strip()})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("work_dir")
    ap.add_argument("--width", type=int, default=1400)
    a = ap.parse_args()

    src = a.input
    ext = os.path.splitext(src)[1].lower()
    os.makedirs(a.work_dir, exist_ok=True)

    pdf = to_pdf(src, a.work_dir)
    n_img = render_pages(pdf, a.work_dir, a.width)
    texts = pdf_page_texts(pdf)

    notes, hidden = ([], [])
    outline = []
    warnings = []
    if ext == ".pptx":
        notes, hidden = pptx_notes(src)
        visible_notes = [n for n, h in zip(notes, hidden) if not h] if any(hidden) else notes
        if any(hidden):
            warnings.append(f"{sum(hidden)} hidden slide(s) were skipped by the PDF export; "
                            "page numbers below count visible slides only.")
        notes = visible_notes
        native = pptx_native_pictures(src, os.path.join(a.work_dir, "pages"), a.width, hidden)
        if native:
            warnings.append(f"{len(native)} slide(s) are a single picture: page images use the "
                            "picture at native resolution (side text is in the page text).")
    elif ext == ".docx":
        outline = docx_outline(src)

    total_hits = []
    pages = []
    for i, t in enumerate(texts, start=1):
        t, h = mask_text(t)
        total_hits += h
        note = notes[i - 1] if i - 1 < len(notes) else ""
        note, h2 = mask_text(note)
        total_hits += h2
        chars = len(re.sub(r"\s", "", t))
        pages.append({
            "n": i,
            "image": f"pages/p{i}.jpg" if i <= n_img else None,
            "text": t,
            "notes": note,
            "chars": chars,
            "image_heavy": chars < 60,
        })

    content = {
        "source": os.path.basename(src),
        "type": ext.lstrip("."),
        "page_count": len(pages),
        "outline": outline,
        "warnings": warnings,
        "secrets_masked": len(total_hits),
        "secret_kinds": sorted({k for k, _ in total_hits}),
        "pages": pages,
    }
    with open(os.path.join(a.work_dir, "content.json"), "w", encoding="utf-8") as f:
        json.dump(content, f, ensure_ascii=False, indent=1)

    md = [f"# {content['source']}  ({content['page_count']} pages)\n"]
    if outline:
        md.append("## Heading outline (from the Word file)\n")
        md += [("  " * max(o["level"] - 1, 0)) + "- " + o["text"] for o in outline]
        md.append("")
    for p in pages:
        md.append(f"\n[[p{p['n']}]]" + ("  (image-heavy: look at the page image)" if p["image_heavy"] else ""))
        md.append(p["text"] or "(no extractable text)")
        if p["notes"]:
            md.append("[SPEAKER NOTES] " + p["notes"])
    with open(os.path.join(a.work_dir, "content.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(md))

    heavy = [p["n"] for p in pages if p["image_heavy"]]
    total_chars = sum(p["chars"] for p in pages)
    print(json.dumps({
        "pages": len(pages),
        "images": n_img,
        "total_chars": total_chars,
        "image_heavy_pages": heavy,
        "secrets_masked": len(total_hits),
        "secret_kinds": content["secret_kinds"],
        "warnings": warnings,
        "content_md": os.path.join(a.work_dir, "content.md"),
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
