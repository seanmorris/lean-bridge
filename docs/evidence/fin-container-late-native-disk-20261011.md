# Stopped Python/Ruby/Rust late-input run

The grouped producer at `f3a7a89eb126abf89dbb0f7750f7b8be781aba35`
was stopped by its disk guard during the second author build. It started with
2,449 MiB free. A packaging burst reduced free space from 893 to 525 MiB between
the ten-second samples; the guard then terminated the process group. The original
TAP contains only its opening line. There is no completed report or accepted
two-build result.

Before the stop, Python 3.11, Ruby and Rust each executed their caller before and
after relocation: 20,158, 20,157 and 20,141 assertions respectively. Those output
files establish partial progress, not complete installed acceptance.

The immutable archive `fin-container-late-native-disk-20261011/` retains 60
artifacts: original start/end/TAP/queue, runner, partial producer records,
selected original scratch metadata and sources, seven Git source snapshots, and
an inventory of the stopped scratch trees. Index SHA-256:
`5c078e4bb1c7dde17fccb62d4647f335575608d1b550c53bd5ae744fbec9e888`.
The inventory records 2,160,208,787 logical file bytes across three retained
directories. Package binaries and complete toolchains are not archived.

Registered archive controls require the stopped outcome and refuse missing or
corrupted originals. After verifying the archive directly from Git, the three
stopped scratch directories can be removed. Their hashes and selected source
files remain; their generated binary files would need to be rebuilt.

Retry each remaining host separately, sharing a JVM package only for Java and
Kotlin. Check free space every second and keep the 2,048 MiB start floor and
768 MiB stop threshold. Preserve this failed attempt rather than replacing its
records. The earlier complete C/C++ run does not need to be repeated.
