"""Detect and mask credentials / secrets in manual text before it goes into an app.

Never print matched values. Only counts and masked previews are reported.
"""
import re

PATTERNS = [
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----")),
    ("openai_like_key", re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}")),
    ("github_token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}")),
    ("slack_token", re.compile(r"\bxox[abprs]-[A-Za-z0-9\-]{10,}")),
    ("aws_access_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}")),
    ("conn_string_cred", re.compile(r"\b[a-z][a-z0-9+]*://[^\s:/@]+:[^\s@/]+@")),
    ("password_field", re.compile(
        r"(?i)(password|passwd|pwd|passcode|secret|api[_\- ]?key|token|密码|口令|비밀번호|패스워드)(\s*[:：=]\s*)([^\s,;，；]{3,})")),
]


def _mask(value: str) -> str:
    keep = value[:4] if len(value) > 8 else value[:1]
    return keep + "****"


def mask_text(text: str):
    """Return (masked_text, hits) where hits is a list of (kind, masked_preview)."""
    hits = []
    if not text:
        return text, hits

    for kind, pat in PATTERNS:
        def repl(m, kind=kind):
            if kind == "password_field":
                label, sep, val = m.group(1), m.group(2), m.group(3)
                hits.append((kind, label + sep + _mask(val)))
                return label + sep + "****"
            if kind == "conn_string_cred":
                s = m.group(0)
                scheme, rest = s.split("://", 1)
                user = rest.split(":", 1)[0]
                hits.append((kind, scheme + "://" + user + ":****@"))
                return scheme + "://" + user + ":****@"
            if kind == "private_key":
                hits.append((kind, "-----BEGIN ... PRIVATE KEY-----"))
                return "[PRIVATE KEY REMOVED]"
            hits.append((kind, _mask(m.group(0))))
            return _mask(m.group(0))
        text = pat.sub(repl, text)
    return text, hits


def mask_obj(obj, hits=None):
    """Recursively mask every string inside a JSON-like object."""
    if hits is None:
        hits = []
    if isinstance(obj, str):
        t, h = mask_text(obj)
        hits.extend(h)
        return t, hits
    if isinstance(obj, list):
        out = []
        for x in obj:
            v, _ = mask_obj(x, hits)
            out.append(v)
        return out, hits
    if isinstance(obj, dict):
        out = {}
        for k, x in obj.items():
            v, _ = mask_obj(x, hits)
            out[k] = v
        return out, hits
    return obj, hits
