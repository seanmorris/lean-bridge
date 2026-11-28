"""Authenticate every archived file and the corresponding pip-installed bytes."""
import base64
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
from zipfile import ZipFile


def digest(stream):
    return hashlib.file_digest(stream, "sha256").digest()


target = Path(sys.argv[1])
verified = {}
for path in map(Path, sys.argv[2:]):
    with ZipFile(path) as z:
        names = z.namelist()
        assert len(names) == len(set(names))
        record, = [p for p in names if p.endswith(".dist-info/RECORD")]
        with z.open(record) as stream:
            rows = list(csv.reader(io.TextIOWrapper(stream, encoding="utf-8", newline="")))
        assert sorted(r[0] for r in rows) == sorted(names)
        for name, expected, size in rows:
            if name == record:
                # pip rewrites RECORD with its own installation metadata.
                assert expected == size == "" and (target / record).is_file()
                continue
            assert not Path(name).is_absolute() and ".." not in Path(name).parts
            with z.open(name) as stream:
                archive_hash = digest(stream)
            assert expected == "sha256=" + base64.urlsafe_b64encode(archive_hash).decode().rstrip("=")
            installed = target / name
            assert installed.is_file() and not installed.is_symlink()
            with installed.open("rb") as stream:
                assert digest(stream) == archive_hash, name
            assert installed.stat().st_size == z.getinfo(name).file_size == int(size)
        verified[path.name] = len(rows) - 1
print(json.dumps(verified, sort_keys=True))
