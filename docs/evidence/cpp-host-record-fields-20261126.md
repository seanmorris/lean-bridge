# C++ record fields preserve shared ownership

The [C++ application](../../tests/fixtures/cpp-host-record/consumer.cpp) constructs
a `Binding<Meter>::Pair` from two different `std::shared_ptr<Meter>`s, a byte
vector and a 131-bit natural. Lean reads the application meter and returns a
flipped pair. Its getters return the original C++ objects and independent
copies of the scalar data. Calling the returned Lean function yields a pointer
with the original control block, not a new owner of the same address.

The application closes the binding and releases its inputs. Both meters
remain alive through the returned pair. Dropping the pair expires one weak
pointer; the other expires only after the application releases its last
getter result. No explicit record close or exposed C ticket is needed.

The client also checks where failures occur:

- A pair from another binding specialization cannot be passed to the function.
  A moved-from second pair is rejected before either meter's read method runs.
- A throwing read arrives as the original `std::exception_ptr`. The same
  binding and a previously created closure remain usable after recoverable failures.
- A result that exports a meter between two 9 MiB buffers exceeds the output
  budget. It raises `std::length_error`; the weak pointer expires immediately
  after the caller drops the original meter.

| Authoring route | Package receipt | Programs compiled and executed |
| --- | --- | --- |
| Ordinary Lean source | [Archive](cpp-host-record-20261126/ordinary.package-set.json) | [pkg-config and CMake](cpp-host-record-20261126/ordinary.execution.json) |
| Edited, reviewed interface | [Archive](cpp-host-record-20261126/reviewed.package-set.json) | [pkg-config and CMake](cpp-host-record-20261126/reviewed.execution.json) |

Run `npm run test:cpp-host-records` on a configured Linux x86-64 producer.
The [installer](../../tests/helpers/c-host-record-installed.mjs) uses a packed
CLI and the compiled [Gauge source](../../tests/fixtures/dotnet-host-record/Workshop.lean)
with the C++ host import. It verifies both receipts, rejects a reviewed field
reordering, and removes the source and release directories before compiling
the installed consumers. This case covers synchronous IO record arguments and
results; it does not establish record-valued errors or asynchronous delivery.
