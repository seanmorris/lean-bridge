# Returned Lean functions over C++ application objects

An installed [C++20 client](../../tests/fixtures/cpp-host-closures/consumer.cpp)
calls a returned Lean function with an ordinary `std::shared_ptr<Meter>`.
It passes one meter and receives the original, distinct captured meter.
If a member throws, the caller receives the original `std::exception_ptr`.
The same function remains callable after that exception.

The client exercises nested calls and closes a function during its own
invocation. That invocation finishes, but another call is immediately
refused. It also destroys the last binding inside a member invocation:
the result survives the call and the old function cannot attach to a replacement
binding. Weak pointers to the captured objects check when each binding
releases its references. Moving the callable transfers the lease; destroying
it on another thread queues cleanup for the owner. Calling it or explicitly
closing it from that thread fails without changing the lease.

In a fresh process, a member returns a null pointer where the contract
requires an object. Both bindings refuse further ordinary calls. Explicit
function and binding cleanup still release the captures independently.
The worker configuration also returns the original pointer through a future
and reads a file twice through a returned function, observing the edit.

| Locally verified C++ package | Package-set receipt (SHA-256) |
| --- | --- |
| Ordinary source | `01e84246ad73da3cf278612ca28be294a6ed95e47bd33835187ad90e4bd73c4c` |
| Reviewed interface | `5c930fd642140c1b0956ffe42c1f22f65071efb36e90114faeff9888f365a900` |
| Worker and filesystem grant | `31521a4775f18da6b2817a0e547841b92fa1d8e499af1aea313a632a4a748178` |

Run `npm run test:cpp-host-closures`. The [install check](../../tests/helpers/c-host-closures-installed.mjs)
installs the archived publisher offline, rejects a stale C owner in the
reviewed interface and rejects the filesystem factory without its grant.
For each successful build it verifies the receipt, relocates the package,
removes the release directory, and compiles the client with GCC 12.2.0
using pkg-config. The resulting executable runs with no build tools on its path.
