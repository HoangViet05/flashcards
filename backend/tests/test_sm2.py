from app.services.sm2 import compute_sm2


def test_quality_below_3_resets_repetitions():
    result = compute_sm2(ease_factor=2.5, interval=6, repetitions=3, quality=2)
    assert result["repetitions"] == 0
    assert result["interval"] == 1


def test_quality_below_3_keeps_ease_factor_unchanged():
    result = compute_sm2(ease_factor=2.5, interval=6, repetitions=3, quality=2)
    assert result["ease_factor"] == 2.5


def test_first_successful_review_sets_interval_to_6():
    result = compute_sm2(ease_factor=2.5, interval=1, repetitions=1, quality=5)
    assert result["interval"] == 6
    assert result["repetitions"] == 2


def test_subsequent_interval_multiplied_by_ease_factor():
    result = compute_sm2(ease_factor=2.5, interval=6, repetitions=2, quality=5)
    assert result["interval"] == 15  # round(6 * 2.5)


def test_ease_factor_decreases_on_hard_quality():
    result = compute_sm2(ease_factor=2.5, interval=1, repetitions=1, quality=3)
    # new_ef = 2.5 + (0.1 - (5-3)*(0.08 + (5-3)*0.02)) = 2.5 - 0.14 = 2.36
    assert abs(result["ease_factor"] - 2.36) < 0.01


def test_ease_factor_minimum_clamped_at_1_3():
    result = compute_sm2(ease_factor=1.3, interval=1, repetitions=1, quality=3)
    assert result["ease_factor"] >= 1.3


def test_zero_repetitions_sets_interval_to_1():
    result = compute_sm2(ease_factor=2.5, interval=1, repetitions=0, quality=5)
    assert result["interval"] == 1
    assert result["repetitions"] == 1
