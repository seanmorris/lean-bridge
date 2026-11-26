# Passing a Lean resource into and out of a public function

All 17 consumer profiles executed both direct export positions on ordinary and reviewed packages: **34 installed profile/route combinations, 68 position checks**. Each consumer called `OwnedCheckedRecords.newTicket` to obtain the resource and passed a Ticket to `OwnedCheckedRecords.serial` to check its value. A record with a Ticket field or a callback exchanging that record would not establish either call.

The [per-profile results](resource-ticket-positions-20261126.json) identify the package receipt, consumer source and execution report on each route. Most results reuse the [original eleven archive selections](owned-checked-record-promotion-20261026-aligned.md). The [audit](../../tests/helpers/resource-ticket-positions-audit.mjs) reads the selected Git blobs, verifies their digests and joins the public calls in the client to the recorded installation and execution. The Wasmtime client uses a generated symbol prefix: the source digest and the compiled-client source digest need not be identical.

For npm, the Node program and the browser entry points shared an executed probe. The production page, React app and dedicated worker each passed in Chromium, Firefox and WebKit. The archived TypeScript program was type-checked only. Its [separate strict TypeScript replay](typescript-ticket-positions-20261126.md) compiled and executed against those exact ordinary and reviewed archives.

Run `npm run test:resource-ticket-positions` from a checkout containing the selected archive revision. This verifies the recorded results without rebuilding eleven packages. To rerun the new TypeScript client itself, run `npm run test:typescript-ticket-positions`.

## Direct callbacks are separate

For Perl, [the hosted CPAN run](standalone-perl-resources-20261122.md) qualifies both direct callback positions independently of the table above. On each of four Perl ABIs, the ordinary and reviewed packages passed the [same client](../../tests/fixtures/perl/resource-callables.t): the callback received the same Perl wrapper as the caller, and a separate exchange returned a *different* Counter with value 77. Wrong-kind replies and the original exception were checked, and all four live counters returned to baseline. This result belongs to Perl, not to all 17 profiles.

The [installed-client audit](../../tests/helpers/resource-callback-positions-audit.mjs)
also checks these ordinary and reviewed package reports against the exact
Lean source and host program from their producer revisions:

| Installed client | Ticket received by callback | Ticket returned by callback |
| --- | --- | --- |
| [Python wheel](owned-python-execution-20260927.json) | The callback used the actual argument as the returned bundle's primary ticket. | The factory made a new Ticket with serial 92, not its recovery Ticket. Three relocated Python environments passed on each route. |
| [Rust crate](owned-rust-execution-20260927.json) | The closure built the expected bundle using its Ticket argument. | The caller read 92 from the newly constructed reply. Both relocated clients passed 596 checks. |
| [C++20 package](owned-cpp-execution-20260927.json) | The lambda used the received Ticket to construct the expected bundle. | The caller distinguished the new Ticket with serial 92 from the fallback. Both linkers passed 577 checks per route. |
| [C11 package](owned-cpp-execution-20260927.json) | **Not credited:** this client discards the callback argument and returns failure. | The client checked the returned ticket against both existing handles and read serial 700. Both linkers passed 693 checks per route. |

Run `npm run test:resource-callback-positions` to verify these joins. This
reads the original installation results; it does not reinstall those historical
packages. The Ruby client in this generation uses a fallback identical to its
callback reply and ignores its input, so it does not add either position here.
