# Downstream consumer status

The [versioned support contract](consumer-support.v1.json) records ten consumers separately. Generated syntax, package layout, and stand-in runtime tests do not establish support. A target becomes `supported` only when a clean consumer installs its documented artifact and executes the real Lean component through the generated public API.

## Browser JavaScript

State: `partial`.

The browser fixtures use the generated API:

```js
import { Box, roundTrip } from "@lean-bridge/alpha";

const box = new Box(41);
const output = roundTrip({
  enabled: false,
  count: 8,
  label: "browser",
  bytes: new Uint8Array([0, 127, 255]),
  values: [1, 5, 13],
});
box.dispose();
```

Raw ESM, a module worker, Vite, Rollup, Webpack, and React execute the real runtime and Alpha component:

```sh
npm run test:browser-bundlers
```

The npm archive still exposes one Node entry point. It has no browser conditional export. CI checks the export map so source-tree browser success cannot become an npm support claim. [Browser acceptance evidence](evidence/browser-bundler-acceptance.md) records the executed matrix.

## Python

State: `blocked`.

The generated API preview uses native Python values and resource conventions:

```python
from lean_alpha import Box, Payload, round_trip, with_callback

with Box(41) as box:
    assert box.read() == 41
    assert box.identity() is box

output = round_trip(Payload(False, 8, "python", b"\x00\x7f", (1, 5, 13)))
assert with_callback(40, lambda value: value) == 42
```

The generator writes importable Python, inline types, `.pyi` stubs, validation, context-managed resources, callbacks, and a typed runtime protocol. Its execution test installs a test runtime, not Lean:

```sh
node --test tests/python-generator.test.mjs
npm run test:pypi-package
```

The canonical bundle has no native component library or Python extension adapter. The PyPI backend returns `package-ineligible` before creating an archive. [PyPI package evidence](evidence/pypi-package.md) records the package checks and blocker.

## Rust

State: `blocked`.

The generated crate preview uses owned resources, borrows, `Result`, and `Drop`:

```rust
use lean_bridge_alpha::{make_adder, with_callback, Box};

let boxed = Box::new(41)?;
assert_eq!(boxed.read()?, 41);
assert_eq!(with_callback(40, |value| Ok(value))?, 42);
let add_two = make_adder(2)?;
assert_eq!(add_two.call(40)?, 42);
```

The crate compiles offline and runs against a generated test trait implementation:

```sh
node --test tests/rust-generator.test.mjs
npm run test:cargo-package
```

The canonical bundle has no native component library or Rust runtime adapter. The Cargo backend returns `package-ineligible`. [Cargo package evidence](evidence/cargo-package.md) records the archive validation and blocker.

## C

State: `blocked`.

The generated C11 preview uses direct prefixed functions and explicit ownership:

```c
#include <lean_alpha.h>

lean_alpha_error error = {0};
lean_alpha_box *box = NULL;
uint32_t value = 0;

if (lean_alpha_box_create(41, &box, &error) == LEAN_ALPHA_STATUS_OK) {
  lean_alpha_box_read(box, &value, &error);
}
lean_alpha_box_dispose(&box);
```

The C generator compiles and runs against a typed test runtime. The package fixture also validates deterministic archives, pkg-config metadata, and CMake discovery:

```sh
node --test tests/c-generator.test.mjs
npm run test:c-family-package
```

The canonical bundle has no native component library. A later eligible native target will also need the generated runtime adapter selected by its package contract. The current C backend returns `package-ineligible`. [C family package evidence](evidence/c-family-package.md) records the distinction between source package validation and real Lean execution.

## C++

State: `blocked`.

The intended generated API would wrap the C ownership contract:

```cpp
#include <lean_alpha.hpp>

lean_alpha::Box box{41};
auto value = box.read();
```

No C++ binding file exists in the canonical bundle. The current backend test constructs an otherwise eligible target and requires `binding-artifacts-absent`:

```sh
npm run test:c-family-package
```

C++ needs both a native Lean component library and a generated C++ binding projection. The test prevents a C archive or a design preview from being presented as C++ support. [C family package evidence](evidence/c-family-package.md) records both gaps.

## WIT and WASI

State: `blocked`.

The generator emits a portable WIT subset:

```wit
package poc:lean-alpha@0.0.0;

interface types {
  resource box {
    constructor(value: u32);
    read: func() -> result<u32, bridge-error>;
  }
}
```

The WIT test uses the official parser, checks the Binding IR identity, and proves that an independent consumer imports the provider's nominal `box` resource:

```sh
npm run generate:wit -- --json
node --test tests/wit-backend.test.mjs
```

The build emits no Component Model binary adapter and runs no component through a WASI host. First-class callbacks, borrowed identity results, and several host capabilities also remain deferred. [WIT projection evidence](evidence/wit-projection.md) records the accepted declarations and stable deferral codes.

## Promotion rules

CI fails when documentation marks a target `supported` without package installation and real Lean execution. It also fails when a blocked target's package test stops producing its recorded blocker. Promote a row in `consumer-support.v1.json` in the same commit that adds the clean consumer and its evidence.
