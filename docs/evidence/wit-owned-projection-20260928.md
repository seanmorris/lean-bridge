# Owned WIT graph projection

VO 1219. Resource-containing records, variants, arrays, Lists, options, results,
products and recursive shapes now have a finite WIT projection. Input types
carry borrowed identities; output types carry owned identities. Each root
carries only its reachable typed node tables. Copied roots contain no unrelated
resource tables. The manifest retains the original ownership sites, source
type graph, binding identity and proof metadata scope.

Named aliases cover resources, callbacks, copied primitives and aggregates.
The projection declares handle aliases directly rather than aliasing an unnamed
handle. The latter validates as a component but triggers an internal dependency
owner assertion when wasm-tools 1.245.1 decodes it as WIT. Parsed source WIT and
decoded component interfaces must agree; decoder validation is not bypassed.

Canonical forwarding releases temporary nested borrow handles after the native
import returns. Cleanup follows only active branches and never drops owned
inputs. Tests cover records, lists, options, results, tuples, aliases, indirect
arguments, mixed borrowed/owned fields, and a 257-case variant. An independent
Wasmtime 42.0.1 C host runs 1,024 calls per shape, verifies each returned owner is
dropped once, and verifies the original borrowed owner remains live. Removing
cleanup must reproduce the borrow-handle trap.

The model and lifetime suites pass 37 tests with no skips. These tests execute
synthetic host imports, not Lean. Existing copied and callable WIT generation
must retain its exact component bytes. The CLI and filtered Perl engine include
the new forwarding dependency, and the WIT CI job requires the lifetime suite.

This milestone does not enable owned WIT builds or change installed support.
Native graph conversion, host callbacks, compiled Lean execution, installed
packages, ownership transfers and anchored borrowed results remain open.
Prior installed receipts remain unchanged. The successor records exact source
transitions and a hash-only refresh of the support index.
