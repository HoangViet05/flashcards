"""Generate the tiny original Flashie audio pack with Python's standard library.

The synthesis is deterministic and does not embed, sample, or imitate third-party work.
"""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

RATE = 22_050
ROOT = Path(__file__).parents[1] / "public" / "audio"


def envelope(t: float, duration: float, attack: float = 0.02, release: float = 0.18) -> float:
    if t < attack:
        return t / attack
    if t > duration - release:
        return max(0.0, (duration - t) / release)
    return 1.0


def write(name: str, duration: float, sample) -> None:
    frames = bytearray()
    for index in range(round(duration * RATE)):
        value = max(-1.0, min(1.0, sample(index / RATE)))
        frames.extend(struct.pack('<h', round(value * 32767)))
    with wave.open(str(ROOT / name), 'wb') as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(bytes(frames))


def ambient(name: str, root: float, shimmer: float) -> None:
    duration = 12.0
    def sample(t: float) -> float:
        pulse = .55 + .45 * math.sin(2 * math.pi * t / 6)
        pad = sum(math.sin(2 * math.pi * frequency * t) for frequency in (root, root * 1.5, root * 2)) / 3
        bell = math.sin(2 * math.pi * shimmer * t) * (max(0, math.sin(2 * math.pi * t / 3)) ** 8)
        return (pad * .045 * pulse) + bell * .025
    write(name, duration, sample)


def effect(name: str, notes: list[tuple[float, float]], duration: float) -> None:
    def sample(t: float) -> float:
        value = 0.0
        for offset, frequency in notes:
            local = t - offset
            if 0 <= local <= .28:
                value += math.sin(2 * math.pi * frequency * local) * envelope(local, .28, .008, .2) * .18
        return value
    write(name, duration, sample)


ROOT.mkdir(parents=True, exist_ok=True)
ambient('ambient-focus.wav', 110.0, 659.25)
ambient('ambient-reader.wav', 98.0, 587.33)
ambient('ambient-boss.wav', 73.42, 440.0)
effect('ui.wav', [(0, 784)], .22)
effect('correct.wav', [(0, 523.25), (.09, 659.25), (.18, 783.99)], .48)
effect('wrong.wav', [(0, 233.08), (.1, 196.0)], .4)
effect('combo.wav', [(0, 659.25), (.07, 783.99), (.14, 987.77)], .45)
effect('checkpoint.wav', [(0, 392.0), (.12, 523.25)], .42)
effect('complete.wav', [(0, 523.25), (.1, 659.25), (.2, 783.99), (.3, 1046.5)], .72)
