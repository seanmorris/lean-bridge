# Use a Lean package

Install the runtime and component archives produced by a Lean author, then import the component by its package name. You do not need Lean or a compiler in the consuming application.

## Start with the tutorial package

The author tutorial produces `onboarding-small`, with two exports: `add` and `isEmpty`. Start with [JavaScript and TypeScript](javascript-typescript.md) to verify the receipt, install the exact archives, and make your first call.

Then choose where those calls run:

| Application | Guide | What you will build |
| --- | --- | --- |
| React | [Use a component from React](react.md) | Load a package, handle errors, and retire pending work when the component unmounts. |
| Browser or worker | [Browser assets and workers](browser-workers.md) | Serve the compiled assets under a subdirectory and run calls in a module worker. |
| An existing algorithm demo | [Use a demo's local API](demo-api.md) | Call the box-overlap solver without the workbench or React. |

The tutorial package returns copied numbers and booleans. It does not expose a handle or require a `dispose()` call. Other APIs can own resources; use the cleanup contract documented for that API.

## Other runtimes

The [downstream consumer guide](consumers.md) records tested package paths. It links to the versioned support contract and executed evidence for each runtime.

- [PHP](php.md) covers native PHP and PHP-Wasm packages.
- [.NET, JVM, and Ruby](dotnet-jvm-ruby.md) covers managed bindings and their registry consumers.
- [All downstream consumers](consumers.md) includes Python, Rust, C, C++, and WIT/WASI.

Support belongs to the named package and runtime profile. The tutorial package and the richer interoperability fixture do not expose the same call shapes.

## Receive a release

For a local handoff, verify the component receipt and both archives before installation. For a signed release, also verify the completed release receipt against a signer policy whose hash you obtained separately. The [handoff guide](publish/local-handoff.md) explains which files to request.

If you need to produce those files, start with [Package a Lean library](lean-author-guide.md).
