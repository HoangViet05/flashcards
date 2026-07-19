from subtitles import merge_fragments, parse_json3, parse_vtt


def test_parse_json3_flattens_events():
    data = {"events": [{"tStartMs": 1000, "dDurationMs": 2000, "segs": [{"utf8": "Hello "}, {"utf8": "world."}]}, {"tStartMs": 3500, "dDurationMs": 1500, "segs": [{"utf8": "[Music]"}]}, {"tStartMs": 5000, "dDurationMs": 1000, "segs": [{"utf8": "Next line"}]}]}
    assert parse_json3(data) == [{"start": 1.0, "end": 3.0, "text": "Hello world."}, {"start": 5.0, "end": 6.0, "text": "Next line"}]


def test_parse_vtt_strips_tags_and_rolling_duplicates():
    vtt = """WEBVTT

00:00:01.000 --> 00:00:03.000
Hello <c>world.</c>

00:00:03.000 --> 00:00:05.000
Hello world.
This is fine.

00:00:05.000 --> 00:00:07.000
This is fine.
Another sentence here.
"""
    assert parse_vtt(vtt) == [{"start": 1.0, "end": 3.0, "text": "Hello world."}, {"start": 3.0, "end": 5.0, "text": "This is fine."}, {"start": 5.0, "end": 7.0, "text": "Another sentence here."}]


def test_parse_vtt_without_hours_and_merge_fragments():
    assert parse_vtt("WEBVTT\n\n00:01.000 --> 00:02.500\nShort form timing.\n") == [{"start": 1.0, "end": 2.5, "text": "Short form timing."}]
    assert merge_fragments([{"start": 0.0, "end": 1.0, "text": "We need to"}, {"start": 1.0, "end": 2.0, "text": "resolve this issue."}]) == [{"start": 0.0, "end": 2.0, "text": "We need to resolve this issue."}]


def test_merge_fragments_splits_when_too_long():
    segments = merge_fragments([{"start": float(i * 4), "end": float(i * 4 + 4), "text": f"chunk {i} no punctuation"} for i in range(5)])
    assert len(segments) > 1 and all(segment["end"] - segment["start"] <= 16.5 for segment in segments)
