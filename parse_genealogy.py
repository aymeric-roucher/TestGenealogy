from __future__ import annotations

import json
import re
from argparse import ArgumentParser
from pathlib import Path
from typing import Iterable, Optional

from pydantic import BaseModel

ROOT = Path(__file__).parent
DEFAULT_SOURCE = ROOT / "source" / "raw_page.txt"
DEFAULT_EXPORT_DIR = ROOT / "export"
DEFAULT_EXPORT_PATH = DEFAULT_EXPORT_DIR / "genealogy.json"

# Expected tab-separated columns as listed in the raw file header.
COLUMN_COUNT = 12


class Person(BaseModel):
    id: int
    generation: int
    gender: Optional[str] = None
    name: str
    birth_date: Optional[str] = None
    birth_place: Optional[str] = None
    spouse: Optional[str] = None
    union_date: Optional[str] = None
    union_place: Optional[str] = None
    children_count: Optional[int] = None
    death_date: Optional[str] = None
    death_place: Optional[str] = None
    age_at_death: Optional[str] = None
    professions: Optional[str] = None


def normalize(value: str) -> Optional[str]:
    cleaned = value.strip()
    return cleaned or None


def parse_children(value: str) -> Optional[int]:
    match = re.search(r"\d+", value)
    return int(match.group()) if match else None


def parse_person_field(value: str) -> tuple[Optional[str], str]:
    cleaned = value.strip()
    if cleaned.startswith("H "):
        return "H", cleaned[2:].strip()
    if cleaned.startswith("F "):
        return "F", cleaned[2:].strip()
    return None, cleaned


def parse_sosa(raw: str) -> Optional[int]:
    numeric = re.sub(r"\D", "", raw)
    return int(numeric) if numeric else None


def parse_line(raw_line: str) -> Optional[Person]:
    stripped = raw_line.lstrip()
    if not stripped or not stripped[0].isdigit():
        return None

    parts = raw_line.rstrip("\n").split("\t")
    if not parts:
        return None

    person_id = parse_sosa(parts[0])
    if person_id is None:
        return None

    # Pad missing columns or merge overflow into the final (professions) column.
    if len(parts) < COLUMN_COUNT:
        parts.extend([""] * (COLUMN_COUNT - len(parts)))
    elif len(parts) > COLUMN_COUNT:
        parts = parts[: COLUMN_COUNT - 1] + [" ".join(parts[COLUMN_COUNT - 1 :])]

    (
        _,
        person_field,
        birth_date,
        birth_place,
        spouse,
        union_date,
        union_place,
        children_count,
        death_date,
        death_place,
        age_at_death,
        professions,
    ) = parts[:COLUMN_COUNT]

    gender, name = parse_person_field(person_field)

    return Person(
        id=person_id,
        generation=person_id.bit_length() - 1,
        gender=gender,
        name=name,
        birth_date=normalize(birth_date),
        birth_place=normalize(birth_place),
        spouse=normalize(spouse),
        union_date=normalize(union_date),
        union_place=normalize(union_place),
        children_count=parse_children(children_count),
        death_date=normalize(death_date),
        death_place=normalize(death_place),
        age_at_death=normalize(age_at_death),
        professions=normalize(professions),
    )


def load_people(path: Path) -> dict[int, Person]:
    people: dict[int, Person] = {}
    with path.open(encoding="utf-8") as handle:
        for raw_line in handle:
            person = parse_line(raw_line)
            if person is None:
                continue
            people[person.id] = person

    return people


def export_people(people: Iterable[Person], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    data = [person.model_dump() for person in sorted(people, key=lambda p: p.id)]
    destination.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = ArgumentParser(description="Parse Sosa-numbered genealogy data and export JSON.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Path to raw_page.txt")
    parser.add_argument("--output", type=Path, default=DEFAULT_EXPORT_PATH, help="Destination JSON file")
    args = parser.parse_args()

    if not args.source.exists():
        raise SystemExit(f"Source file not found: {args.source}")

    people = load_people(args.source)
    export_people(people.values(), args.output)
    print(f"Exported {len(people)} people to {args.output}")


if __name__ == "__main__":
    main()
