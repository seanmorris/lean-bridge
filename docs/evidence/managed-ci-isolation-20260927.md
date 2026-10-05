# Independent managed-consumer CI jobs

VO task 1219. The downstream run for ab88c38 cancelled the combined .NET,
JVM and Ruby job at its four-hour limit. The .NET and JVM steps passed.
Ruby was still executing its native recursive conversion checks when the
runner cancelled it. The job log reports cancellation rather than an
assertion failure at that point.

The managed-consumers job now uses three matrix entries: dotnet, jvm and ruby.
Each receives its own four-hour budget. Fail-fast is disabled. The existing
prepared-package baseline runs in each entry. The native compiler bootstrap
runs before the selected language's tests, so Java and Ruby no longer depend
on setup performed by the .NET step.

The selected profile runs its original ordinary-source and type-corpus command
blocks. The verifier compares all six complete blocks against the authenticated
predecessor, including their required output-file checks. Compiler versions and
uploaded corpus evidence remain unchanged. Only the selected consumer produces
an observation, and its artifact name includes its profile.

Routing tests cover 27 failed, skipped or cancelled selected-step outcomes.
Every such outcome triggers the final failure gate. Other profiles' skipped
steps do not fail a successful entry. Mutation tests reject shared artifact
names, missing profiles, weakened gates and profile-specific shared bootstrap.
The documentation contract uses those routing checks for matrix consumers
instead of requiring their names in one shared shell loop.

This receipt verifies workflow routing and command preservation. It does not
claim a new hosted CI execution or promote installed type-surface cells.
All earlier execution receipts remain unchanged.
