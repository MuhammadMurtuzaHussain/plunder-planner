"""Parse fortnite.gg's items file (a JS literal, not JSON) into Python data without executing it."""
import json, re

def js_literal_to_json(src: str) -> str:
    out = []; i = 0; n = len(src)
    while i < n:
        c = src[i]
        if c == '"':
            j = i + 1
            while src[j] != '"':
                j += 2 if src[j] == '\\' else 1
            out.append(src[i:j + 1]); i = j + 1
        elif c.isalpha() or c in '_$':
            j = i
            while j < n and (src[j].isalnum() or src[j] in '_$'):
                j += 1
            word = src[i:j]
            if j < n and src[j] == ':':
                out.append('"' + word + '"')
            elif word in ('true', 'false', 'null'):
                out.append(word)
            else:
                raise ValueError('unexpected identifier %r at %d' % (word, i))
            i = j
        elif c == ',':
            j = i + 1
            while j < n and src[j].isspace():
                j += 1
            if j < n and src[j] in ']}':
                i += 1  # trailing comma
            else:
                out.append(c); i += 1
        else:
            out.append(c); i += 1
    return ''.join(out)

def load(path):
    t = open(path, encoding='utf-8').read()
    m = re.match(r'\s*Sets=(\[.*?\]);?\s*Items=(\[.*\])\s*;?\s*$', t, re.S)
    sets = json.loads(m.group(1))
    items = json.loads(js_literal_to_json(m.group(2)))
    return sets, items
