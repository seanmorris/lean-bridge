# Empty Fin 0 nominal collections

Producer `7f32996dce66ea7ab191c8c23b031a0b13c1ffe2` adds a separate
fixture for the missing empty-collection cases in VO #1442. Older fixtures
and their reports remain unchanged.

The fixture checks arrays and lists of a record with a `Fin 0` field,
records containing `Array (Fin 0)` and `List (Fin 0)`, and collections of
those records. Empty values succeed. Populated zero-bound fields fail at
the exact nested path. Each public consumer compares rejected inputs
with independent snapshots before restoring them and runs 1,000
rejection/recovery pairs.

## Installed observations

| Selection | Ordinary source | Independently reviewed source |
| --- | --- | --- |
| C and C++ | Passed, 2,046 assertions per consumer | Passed, 2,046 assertions per consumer |
| Python 3.11.16 at the original producer | Failed: test expected lists instead of tuples | Same test expectation failure |
| Python 3.11.16 at repaired producer `8fdec75` | Passed, 2,046 assertions | Passed, 2,046 assertions |
| Python 3.12.14, Ruby, Java, and Kotlin at producer `3c41650` | Passed, 2,046 assertions per consumer | Passed, 2,046 assertions per consumer |

The C/C++ harness rebuilt each route from two unrelated author directories
and required byte-identical archives. It removed author and build staging
before installing the prepared packages offline. Three changed reviews
also failed against fresh Lean before output: a loosened record bound, a
loosened array-field bound, and an omitted list-field bound.

Python accepts list inputs but returns tuples for copied collections,
including record fields. The original test used list-shaped expected
outputs. Commit `8fdec75af4ab853ee18b3b9159784174a37df86a` corrects those
expectations. The repaired installed run passes both routes and their
two-root reproducibility checks. The failed original remains archived
and supplies no acceptance evidence.

All four runs used local glibc 2.36 and configured floor 2.36. They
are not hosted CI results or minimum-platform tests. This supplement does
not measure source or adapter dispatch. Earlier #1442 dispatch observations
retain their separate scope.

Each archive preserves the original start/end records, TAP, runner, a
manifest of producer source hashes, and 33 selected source snapshots.
Each successful archive also retains both reports and its verification
record. The selected snapshots are not a full build dependency closure.
The installed harness removed package binaries; their digests and sizes
remain in the successful reports.

Indexes:

- [C/C++ pass](fin-record-zero-native-20261010/c-cpp-7f32996/index.json):
  `5e975db58e3c2816f02bcefaa63380976797d54877329be48ddb2a2c69766aae`.
- [Original Python failure](fin-record-zero-native-20261010/python311-7f32996/index.json):
  `b8ded2711303e9badf36994c3b8f80fe2b641ee673eeb78e6b706ff7cb2461a7`.
- [Repaired Python pass](fin-record-zero-native-20261010/python311-8fdec75/index.json):
  `4d03aec16689260f2309db46630a6c644866243be808f0c858a42b4dba59099a`.
- [Python 3.12, Ruby, Java, and Kotlin pass](fin-record-zero-native-20261010/python312-ruby-jvm-3c41650/index.json):
  `5894e167f280b207c92817273bb4c67697320cd2a269b01942d239c0b73ddeda`.

#1442 remains open for the remaining installed selections and its complete
acceptance audit. These observations do not close #1220.
