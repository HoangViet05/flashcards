def compute_sm2(ease_factor: float, interval: int, repetitions: int, quality: int) -> dict:
    """
    Compute next SM-2 state after a review.
    quality: 0-5 (0=blackout, 5=perfect)
    Returns dict with keys: ease_factor, interval, repetitions
    """
    if quality < 3:
        return {
            "ease_factor": ease_factor,
            "interval": 1,
            "repetitions": 0,
        }

    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    new_repetitions = repetitions + 1

    if repetitions == 0:
        new_interval = 1
    elif repetitions == 1:
        new_interval = 6
    else:
        new_interval = round(interval * ease_factor)

    return {
        "ease_factor": new_ef,
        "interval": new_interval,
        "repetitions": new_repetitions,
    }
