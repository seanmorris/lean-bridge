# Native callback Subtype acceptance

Local installed-package acceptance at producer revision
`a031522d08d2130cb0d54ae33c39d0525bf1ee0c` covers checked `Subtype`
values in both directions of synchronous callbacks for C, C++, and Perl.

## C and C++

The ordinary-source and reviewed-IR routes each produced source-free C and C++
packages. The unchanged C11/GMP and C++20 callers installed them offline and
ran without the author source or compiler path. C completed 16 checks per route;
C++ completed 13 checks per route. The retained report has SHA-256
`31d541c019fd1589c82c2e198144b017b124b4ca9a58c9568fb5500a4921d18f`.

The checks establish exact typed recovery for host callback results, rejection
before the callback body when the recovery is invalid, checked host results,
checked inputs to returned Lean closures, recovery after rejection, and the
absence of public closure call/dispose operations on host-only callbacks.

## Perl

The ordinary-source and reviewed-IR routes each produced complete component and
runtime CPAN archives. The unchanged caller installed them after author-source
removal and replayed them after relocation on threaded and unthreaded Perl
5.36.3 and 5.38.2, in both prebuilt-only and build-XS modes. All 16 cells
completed 34 checks, five successful calls, and six expected rejections. The
retained report has SHA-256
`8c41f0f48e36f0293e1e85e40b98d246879c7e02214f1449471d49bb5bd0ed4a`.

The checks establish `Runtime::Callback->new(code => ..., recovery => ...)`,
exact constructor checking for the recovery and callback result, checked inputs
to returned Lean closures, source-free loading, repeated execution, and
recovery after rejection on all four prepared ABIs.

## Boundary

This evidence covers the fixture's `Nat` Subtypes in synchronous host callbacks
and returned Lean closures on Linux x64/glibc 2.36. It does not establish
asynchronous or retained host callbacks, arbitrary predicates, recursive or
generic refined callback payloads, other native operating systems or
architectures, dispatch cost, or memory bounds. The local run retained the two
machine-readable reports but not its terminal TAP or package bytes. Dedicated
hosted workflows retain original TAP and reports on every accepted run; the
Perl report also retains the exact component/runtime archive identities from
the local execution.
