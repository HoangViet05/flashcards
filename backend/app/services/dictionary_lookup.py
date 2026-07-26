"""Generate likely base forms for offline dictionary lookup."""


def lookup_candidates(word: str) -> list[str]:
    value = word.strip().lower()
    candidates = [value]
    for suffix in ("'s", "es", "s", "ed", "ing"):
        if value.endswith(suffix) and len(value) - len(suffix) >= 2:
            stem = value[:-len(suffix)]
            candidates.append(stem)
            if suffix in ("ed", "ing"):
                candidates.append(stem + "e")
                if len(stem) >= 2 and stem[-1] == stem[-2]:
                    candidates.append(stem[:-1])
    return list(dict.fromkeys(candidates))
