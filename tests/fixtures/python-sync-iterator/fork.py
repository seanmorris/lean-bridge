import os
import sys
import warnings
from pathlib import Path
from lean_counting import counts, units

live = units(7)
assert next(live) is None
marker = Path("iterator-finalizer")
marker.write_text("parent still owns cursor")
# CPython 3.12 warns at this exact call because Lean has native threads.
# Deliberately exercise only child-side refusal and shutdown, not Lean work.
with warnings.catch_warnings():
    warnings.filterwarnings("ignore", category=DeprecationWarning,
                            message=r".*multi-threaded.*fork\(\).*")
    child = os.fork()
if child == 0:
    try:
        next(live)
    except RuntimeError:
        sys.exit(0)  # Run normal interpreter shutdown with the inherited cursor.
    sys.exit(1)
assert os.waitstatus_to_exitcode(os.waitpid(child, 0)[1]) == 0
assert marker.read_text() == "parent still owns cursor", "child ran the parent's finalizer"
assert counts() == 10100 and next(live) is None
live.close()
assert counts() == 10201 and marker.read_text() == "closed"
print("child exit left the owner cursor usable")
