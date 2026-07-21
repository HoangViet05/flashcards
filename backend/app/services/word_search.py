import math
import random
import re
import string

MAX_SIZE = 13
DIRECTIONS = {"h": (0, 1), "v": (1, 0), "d": (1, 1)}


def normalize_word(text: str) -> str:
    return re.sub(r"[^A-Za-z]", "", text or "").upper()


def _attempt(words: list[dict], size: int, rng: random.Random):
    grid: list[list[str | None]] = [[None] * size for _ in range(size)]
    placements: list[dict] = []
    failed: list[dict] = []
    for entry in words:
        word = entry["word"]
        options: list[tuple[int, int, int, str]] = []
        for direction, (dr, dc) in DIRECTIONS.items():
            for row in range(size):
                for col in range(size):
                    if row + dr * (len(word) - 1) >= size or col + dc * (len(word) - 1) >= size:
                        continue
                    overlap, valid = 0, True
                    for i, letter in enumerate(word):
                        cell = grid[row + dr * i][col + dc * i]
                        if cell is not None:
                            if cell != letter:
                                valid = False
                                break
                            overlap += 1
                    if valid:
                        options.append((overlap, row, col, direction))
        if not options:
            failed.append(entry)
            continue
        best = max(option[0] for option in options)
        _, row, col, direction = rng.choice([option for option in options if option[0] == best])
        dr, dc = DIRECTIONS[direction]
        for i, letter in enumerate(word):
            grid[row + dr * i][col + dc * i] = letter
        placements.append({"card_id": entry["card_id"], "word": word, "row": row, "col": col, "dir": direction})
    return grid, placements, failed


def generate_puzzle(entries: list[dict], rng: random.Random | None = None) -> dict:
    rng = rng or random.Random()
    words, unplaced = [], []
    for entry in entries:
        word = normalize_word(entry["word"])
        if not word or len(word) > MAX_SIZE:
            unplaced.append(entry["card_id"])
        else:
            words.append({"card_id": entry["card_id"], "word": word})
    if not words:
        return {"size": 0, "grid": [], "placements": [], "unplaced": unplaced}
    words.sort(key=lambda item: len(item["word"]), reverse=True)
    size = min(MAX_SIZE, max(len(words[0]["word"]), math.isqrt(sum(len(item["word"]) for item in words) * 2) + 1))
    while True:
        grid, placements, failed = _attempt(words, size, rng)
        if not failed or size == MAX_SIZE:
            break
        size += 1
    unplaced.extend(item["card_id"] for item in failed)
    for row in range(size):
        for col in range(size):
            if grid[row][col] is None:
                grid[row][col] = rng.choice(string.ascii_uppercase)
    return {"size": size, "grid": grid, "placements": placements, "unplaced": unplaced}


def find_placement(puzzle: dict, start_row: int, start_col: int, end_row: int, end_col: int) -> dict | None:
    for placement in puzzle["placements"]:
        dr, dc = DIRECTIONS[placement["dir"]]
        end = (placement["row"] + dr * (len(placement["word"]) - 1), placement["col"] + dc * (len(placement["word"]) - 1))
        if (placement["row"], placement["col"]) == (start_row, start_col) and end == (end_row, end_col):
            return placement
    return None
