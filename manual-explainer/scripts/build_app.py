#!/usr/bin/env python3
"""Build the self-contained explainer app (one HTML file).

Usage:
    python build_app.py <lesson.json> <work_dir> <out.html> [--budget-mb 13]

<work_dir> is the folder extract_manual.py wrote (it holds pages/pN.jpg).
The lesson JSON is validated, every string in it is secret-masked again,
page images are re-encoded and embedded as data: URIs within the size budget.
"""
import argparse
import base64
import html
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from secrets_scan import mask_obj  # noqa: E402

TEMPLATE = os.path.join(HERE, "..", "assets", "template.html")


def fail(msg):
    raise SystemExit("LESSON ERROR: " + msg)


LANG_KEYS = {"zh", "ko", "en", "ja"}


def is_tr(o, langs):
    return isinstance(o, dict) and o and all(k in langs or k in LANG_KEYS for k in o)


def localize(o, lang, langs):
    if isinstance(o, list):
        return [localize(x, lang, langs) for x in o]
    if is_tr(o, langs):
        v = o.get(lang)
        if v is None:
            v = next(iter(o.values()))
        return localize(v, lang, langs)
    if isinstance(o, dict):
        return {k: (v if k == "knowledge" else localize(v, lang, langs)) for k, v in o.items()}
    return o


NON_TEXT_KEYS = {"id", "image", "page_refs", "answer", "knowledge", "language", "languages",
                 "source_file", "page_count"}


def missing_translations(o, langs, path="", out=None):
    """In a multi-language lesson every visible text must be a {lang: text} object."""
    if out is None:
        out = []
    if isinstance(o, list):
        for i, x in enumerate(o):
            missing_translations(x, langs, f"{path}[{i}]", out)
    elif is_tr(o, langs):
        miss = [l for l in langs if o.get(l) in (None, "", [])]
        if miss:
            out.append(f"{path}: missing {', '.join(miss)}")
    elif isinstance(o, dict):
        for k, v in o.items():
            if k not in NON_TEXT_KEYS:
                missing_translations(v, langs, f"{path}.{k}" if path else k, out)
    elif isinstance(o, str) and o.strip():
        out.append(f"{path}: plain text, needs {{{', '.join(langs)}}}")
    return out


def validate(lesson, page_count):
    langs = [l[:2] for l in (lesson.get("languages") or [lesson.get("language", "zh")])]
    for ci, ch in enumerate(lesson.get("chapters", [])):
        for si, st in enumerate(ch.get("steps", []) if isinstance(ch.get("steps"), list) else []):
            if isinstance(st, dict):
                st.setdefault("id", f"c{ci+1}s{si+1}")
    if len(langs) > 1:
        miss = missing_translations(lesson, langs)
        if miss:
            fail("incomplete translations:\n  - " + "\n  - ".join(miss[:40]))
        used, refs = set(), set()
        for l in langs:
            u, r = validate_one(localize(lesson, l, langs), page_count, l)
            used |= u
            refs |= r
        return used, refs
    return validate_one(lesson, page_count, langs[0])


def validate_one(lesson, page_count, lang):
    problems = []
    for key in ("title", "chapters", "knowledge"):
        if not lesson.get(key):
            problems.append(f"missing top-level '{key}'")
    used_pages = set()
    ref_pages = set()
    seen_ids = set()
    for ci, ch in enumerate(lesson.get("chapters", [])):
        if not ch.get("title"):
            problems.append(f"chapter {ci+1} has no title")
        if not ch.get("steps"):
            problems.append(f"chapter {ci+1} has no steps")
        for si, st in enumerate(ch.get("steps", [])):
            where = f"chapter {ci+1} step {si+1}"
            if not st.get("title"):
                problems.append(where + ": no title")
            if not st.get("narration"):
                problems.append(where + ": no narration")
            sid = st.get("id") or f"c{ci+1}s{si+1}"
            if sid in seen_ids:
                problems.append(where + f": duplicate id {sid}")
            seen_ids.add(sid)
            st["id"] = sid
            img = st.get("image")
            if img is not None:
                if not isinstance(img, int) or not (1 <= img <= page_count):
                    problems.append(where + f": image {img!r} is not a page number 1..{page_count}")
                else:
                    used_pages.add(img)
            for p in st.get("page_refs", []) or []:
                if isinstance(p, int) and 1 <= p <= page_count:
                    ref_pages.add(p)
        for qi, q in enumerate(ch.get("quiz", []) or []):
            opts = q.get("options") or []
            if not q.get("q") or len(opts) < 2:
                problems.append(f"chapter {ci+1} quiz {qi+1}: needs q and >=2 options")
            elif not isinstance(q.get("answer"), int) or not (0 <= q["answer"] < len(opts)):
                problems.append(f"chapter {ci+1} quiz {qi+1}: answer must be a 0-based option index")
    if problems:
        fail(f"[{lang}]\n  - " + "\n  - ".join(problems))
    return used_pages, ref_pages


def _encode(path, width, quality):
    from PIL import Image
    im = Image.open(path).convert("RGB")
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    # WebP keeps slide text sharper than JPEG at the same size.
    im.save(buf, "WEBP", quality=quality, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def encode_pages(work_dir, page_count, used, refs, budget_bytes):
    """Embed page images within the budget.

    Step images (used) are required and get the sharpest setting that still leaves
    room; referenced pages (refs) come next at a lighter setting, then all other
    pages if anything is left. Other pages are smaller but stay readable in the zoomable viewer.
    """
    pdir = os.path.join(work_dir, "pages")
    path = lambda n: os.path.join(pdir, f"p{n}.jpg")
    used = [n for n in sorted(used) if os.path.exists(path(n))]
    refs = [n for n in sorted(set(refs) - set(used)) if os.path.exists(path(n))]
    rest = [n for n in range(1, page_count + 1)
            if n not in used and n not in refs and os.path.exists(path(n))]
    cache = {}
    def uri_of(n, w, q):
        if (n, w, q) not in cache:
            cache[(n, w, q)] = _encode(path(n), w, q)
        return cache[(n, w, q)]
    best = None
    # (step image setting, other page setting), most readable first
    combos = (((1800, 70), (1800, 62)), ((1400, 62), (1400, 55)), ((1400, 62), (1000, 45)), ((1400, 58), (850, 45)), ((1200, 55), (850, 42)),
              ((1200, 52), (720, 40)), ((1000, 50), (720, 40)), ((850, 45), (640, 38)))
    for (width, quality), (lw, lq) in combos:
        out, total, seen = {}, 0, {}
        def put(n, uri):
            # identical pages (section dividers, repeated tables of contents) are stored once
            nonlocal total
            if uri in seen:
                out[f"p{n}"] = "@" + seen[uri]
                total += 8
                return True
            if total + len(uri) > budget_bytes:
                return False
            seen[uri] = f"p{n}"
            out[f"p{n}"] = uri
            total += len(uri)
            return True
        ok = True
        for n in used:
            ok = put(n, uri_of(n, width, quality)) and ok
        if not ok:
            continue
        for n in refs + rest:
            put(n, uri_of(n, lw, lq))
        n_refs = sum(1 for n in refs if f"p{n}" in out)
        cand = (out, total, width, quality, n_refs, lw, lq)
        if n_refs == len(refs):
            return cand[:4] + (lw, lq)
        if best is None or n_refs > best[4]:
            best = cand
    if best is None:
        fail("page images do not fit the size budget even at the smallest setting; "
             "use fewer distinct pages as step images")
    return best[:4] + best[5:7]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lesson")
    ap.add_argument("work_dir")
    ap.add_argument("out")
    ap.add_argument("--budget-mb", type=float, default=14.5)
    a = ap.parse_args()

    with open(a.lesson, encoding="utf-8") as f:
        lesson = json.load(f)
    with open(os.path.join(a.work_dir, "content.json"), encoding="utf-8") as f:
        content = json.load(f)
    page_count = content["page_count"]
    lesson.setdefault("source_file", content.get("source"))
    lesson["page_count"] = page_count

    used, refs = validate(lesson, page_count)
    lesson, hits = mask_obj(lesson)

    # knowledge is the Q&A corpus; keep it within what one Claude call can take
    k = re.sub(r"[ \t]*\(image-heavy: look at the page image\)", "", lesson.get("knowledge", ""))
    lesson["knowledge"] = k
    if len(k.encode("utf-8")) > 200_000:
        print("NOTE: knowledge > 200 KB; the app will send the most relevant pages per question.")

    tpl = open(TEMPLATE, encoding="utf-8").read()
    lesson_budget = len(json.dumps(lesson, ensure_ascii=False).encode())
    budget = int(a.budget_mb * 1024 * 1024) - lesson_budget - len(tpl.encode())
    images, img_bytes, width, quality, lw, lq = encode_pages(a.work_dir, page_count, used, refs, budget)

    def js(obj):
        return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")

    langs = [l[:2] for l in (lesson.get("languages") or [lesson.get("language", "zh")])]
    default = (lesson.get("language") or langs[0])[:2]
    title = localize(lesson["title"], default, langs)
    out = (tpl.replace("__TITLE__", html.escape(str(title)))
              .replace("__LANG__", html.escape(default))
              .replace("/*__LESSON__*/", js(lesson))
              .replace("/*__IMAGES__*/", js(images)))
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(out)

    steps = sum(len(c["steps"]) for c in lesson["chapters"])
    report_langs = langs
    quizzes = sum(len(c.get("quiz", []) or []) for c in lesson["chapters"])
    print(json.dumps({
        "out": a.out,
        "size_mb": round(os.path.getsize(a.out) / 1048576, 2),
        "languages": report_langs,
        "chapters": len(lesson["chapters"]),
        "steps": steps,
        "quiz_questions": quizzes,
        "pages_embedded": len(images),
        "pages_used_by_steps": len(used),
        "image_setting": f"step images {width}px q{quality}, other pages {lw}px q{lq}",
        "secrets_masked_in_lesson": len(hits),
        "ref_pages_embedded": sum(1 for n in refs if f"p{n}" in images),
        "ref_pages_total": len(refs | used),
        "uncovered_pages": [n for n in range(1, page_count + 1) if n not in used and n not in refs],
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
