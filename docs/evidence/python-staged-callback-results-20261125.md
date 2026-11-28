# Return a Lean function directly from a Python callback

The [Python application](../../tests/fixtures/structured-types/tariff-staged.py)
imports `lean_tariff_quotes` from an installed wheel. The flat callback
receives two numbers and returns 103. The staged callback receives one
number and returns a Lean function; Lean applies it to the second number.

| Author route | Package-set receipt | Installed execution |
| --- | --- | --- |
| Ordinary Lean source and export contract | [Receipt](python-staged-callback-results-20261125/ordinary.package-set.json) | [Results](python-staged-callback-results-20261125/ordinary.execution.json) |
| Independently authored reviewed interface | [Receipt](python-staged-callback-results-20261125/reviewed.package-set.json) | [Results](python-staged-callback-results-20261125/reviewed.execution.json) |

Returning a newly constructed price function gives 93. Returning a
previously owned one gives 703 and the application can still call it.
An absent or non-Lean recovery function is rejected before the Python
callback runs. If the callback raises, the caller receives the exact same
`ValueError` instance. If it returns a Python lambda or a different kind of
Lean resource, the callback ran once but its reply raises `TypeError`. A
subsequent valid reply still works.

A [separate observer](../../tests/fixtures/structured-types/leased-closure-field-leases.py)
reads the loaded native runtime after each of the five case groups. The
session is the only live identity, with no outstanding result slots; closing
it drops the count to zero. The observer does not force garbage collection.

Run `npm run test:leased-closure-fields` with the pinned Lean author
toolchain. The [install test](../../tests/leased-closure-fields-install.test.mjs)
deletes the producer and source before installing offline, relocates the
environment, and runs the consumer in isolated CPython. The local results
are from Linux x86-64, glibc 2.36, CPython 3.12.14. They do not register
Python lambdas for later calls from Lean.
