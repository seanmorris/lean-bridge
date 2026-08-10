# Publish credential boundary evidence

## Result

The publish CLI can verify a release without reading a registry secret. It creates the credential boundary only after `verifyPublishManifest` has accepted the manifest, release authorization, candidate inventory, publication index, target selection, and ordered actions.

The execution order is fixed:

```text
verify publish manifest and complete candidate inventory
  ↓
create credential boundary from verified target requirements
  ↓
check that each required environment name is available
  ↓
grant one target-scoped registry callback
  ↓
read only that target's declared values
  ↓
reject secret-bearing results, errors, and progress events
  ↓
emit a value-free credential audit and close the boundary
```

Dry run never creates or calls the boundary. A missing registry publisher also stops before credential preflight.

## Provider contract

[`src/release/credentials.mjs`](../../src/release/credentials.mjs) defines a registry-neutral provider with `kind`, `has(name)`, and `read(name)`. The default provider reads process environment values. The boundary accepts only uppercase environment names declared by the verified publish manifest.

Preflight calls `has(name)`. It does not call `read(name)`. Missing names produce `publish-credentials-missing` with ecosystem, package coordinate, and environment names. The diagnostic contains no values.

An installed publisher receives a `credentials` capability. It must perform authenticated work inside `credentials.withTarget(target, callback)`. The callback receives only the names authorized for that target and a guarded `get(name)` method. The boundary rejects concurrent target leases, targets outside the verified plan, archive-only targets, undeclared names, empty provider values, and credentials that disappear after preflight.

## Output controls

The boundary records every value it releases for the duration of the command. It rejects a publisher result, structured progress event, or callback error that contains any observed value. Publisher exceptions become a value-free `registry-publisher-failed` or `credential-operation-failed` diagnostic. The CLI closes the boundary in a `finally` block on success, failure, blocking input, or cancellation.

A failure before publisher invocation reports `externalRegistryWrites: false`. A failure after invocation reports `externalRegistryWrites: unknown`; the CLI does not claim that an unjournaled adapter performed no write. Node 896 will replace that uncertainty with per-target transaction records.

The machine-readable audit contains:

- provider kind;
- boundary status;
- required environment names;
- availability by target;
- target access counts;
- whether any value was read; and
- the policy claim that no value is retained after the boundary closes.

[`schema/credential-audit.schema.json`](../../schema/credential-audit.schema.json) closes this record. The boundary holds observed values in memory while it checks publisher output, clears them when the command closes, and never writes them into the publish manifest, credential audit, CLI result, diagnostics, or progress events.

Registry adapters remain trusted publishing code. They must use the supplied progress callback and must not write credential values directly to process output. Node 896 will add constrained registry adapters and transaction journals on top of this boundary.

## Tests

[`tests/credential-boundary.test.mjs`](../../tests/credential-boundary.test.mjs) proves that preflight checks names without reading values, target access reads only declared names, missing values block before reads, archive targets cannot request credentials, and values cannot escape through results or exceptions.

[`tests/cli-contract.test.mjs`](../../tests/cli-contract.test.mjs) proves that dry run never calls a credential provider, verification happens before preflight, missing credentials prevent publisher invocation, successful publishers use the target capability, credential audits contain no values, and secret-bearing results or progress events fail before CLI output.

Run the focused evidence:

```sh
node --test tests/credential-boundary.test.mjs tests/cli-contract.test.mjs
```
