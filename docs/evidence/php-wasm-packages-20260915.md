# Installed ordinary PHP-Wasm packages

VO1216 packages the [ordinary Lean compiler output](php-wasm-ordinary-20260915.md) as two npm archives and one Composer ZIP. The package profile is `php-wasm-copied-startup-v1`, using PHP-Wasm 0.1.0, PHP 8.4.1 and Emscripten 3.1.68.

## Package layout and loading

The component npm package depends on an exact version of `@lean-bridge/php-wasm-copied-runtime`. That runtime version binds the compiled runtime, loader source, packaging implementation, archive implementation and license notices. Two components built for the same runtime produce the same runtime archive. The universal JavaScript runtime uses a different package and ABI.

The default component descriptor registers the runtime and Zend extension through PHP-Wasm's `sharedLibs` interface. It also mounts the generated PHP files. Its `autoload` property names the mounted API file. Consumers do not select a runtime binary or call its initializer.

For a Composer application, the component's named `extensions` export registers the libraries without mounting another copy of the PHP sources. The application mounts its installed `vendor` directory and requires `vendor/autoload.php`. The companion Composer package records the exact npm counterpart and compiled component identity; it does not require FFI or an install hook.

Registration deduplicates libraries and PHP files per host. It rejects runtime and loader mismatches, different compiled definitions of the same component, PHP namespace collisions, shared-library filename collisions and Composer mount-path collisions. Separate hosts keep separate registration state. Unsupported PHP versions, nondefault variants, registration after startup and `dynamicLibs` use fail explicitly.

Generated modules declare static asset URLs for the runtime, extension and PHP sources. Vite can copy those files into a production build. The descriptor checks compatibility identities; npm installation and the handoff verifier check package bytes. The descriptor does not hash network responses.

## Release verification

`buildPhpWasmCopiedPackages` reads the closed compiler and runtime receipts, reconstructs the copied adapters, and assembles a new handoff directory atomically. It preserves both verified artifact trees and includes Lean, Lean Bridge and runtime dependency notices. It refuses existing output directories and output paths inside its compiled inputs.

`readVerifiedPhpWasmCopiedPackageSet` checks `php-wasm-package-set.json`, its exact file inventory, compiled models, runtime identity, generated loading code, package metadata and matching Composer PHP files. It recreates the deterministic archives and compares their bytes. Updating a file's inventory hash cannot authorize a substituted loader, PHP wrapper or archive.

## Acceptance

Run the suite after preparing the pinned SDK and target runtime as described in [contributor testing](../contributing/testing.md#consumer-acceptance):

```sh
LEAN_BRIDGE_PHP_WASM_ORDINARY_TEST=1 \
  node --test --test-reporter=spec tests/php-wasm-ordinary.test.mjs
```

Willow and Aspen each expose 44 actual Lean functions. Both use `SharedApi` as their Lean module and namespace, with different record layouts and implementations. The test builds and packages each project from two locations, compares all archive hashes, and verifies that both packages select the same runtime archive.

The installer uses local npm archives with networking and lifecycle scripts disabled. Composer uses local ZIPs with plugins, scripts and networking disabled. Composer's platform setting selects PHP 8.4.1 for the target host even when the installation machine uses another PHP version. The test moves the installed application and makes the original archive, source and build paths unavailable.

Separate PHP-Wasm hosts exercise the npm-embedded PHP sources, Composer autoloading and Vite-bundled assets. The execution process has no compiler commands on `PATH`. Each route checks all 88 exports, exact large integers, arrays and records, strict weak-mode validation, output-budget recovery and 20 further requests. A test-only probe reads the production broker and requires one runtime initialization, two initialized components, two attachments and zero live identities. Duplicate descriptors must not load duplicate extensions or PHP files.

The Vite check executes its generated asset URLs in the Node-hosted PHP-Wasm runtime. It does not establish browser-engine execution of these ordinary packages.

The fresh-runtime acceptance run passed all three tests in 163.4 seconds. Both source relocations produced these archive hashes:

| Archive | SHA-256 |
| --- | --- |
| Shared runtime, both components | `88cb5998a91d222bb8244b3d11c98d0962e5c53e2989a143345971ee403e927a` |
| Willow npm component | `2ac23ea1a07f0277412b3b9bcd5f2784376d7b600ca462bcd892cc34c4ab1ed3` |
| Aspen npm component | `f61e4341d17b1df209e7712143d97d32da5493bccca5e2f73ee18607f1f32291` |
| Willow Composer API | `2d09b5f06057f1b6af51ce6f56301376278e846468fb2717ea3221b31c120e08` |
| Aspen Composer API | `e96a949124d72a9c8f2fbf43abac95dbc7d48e6da8238e5024fccfa4e60ef799` |

## Remaining integration

This stage exposes internal package-building and verification functions. Public CLI selection, shared source configuration for the npm/Composer coordinates, and atomic native/npm/PHP-Wasm orchestration remain in VO1216. Lazy loading remains unimplemented for the ordinary copied profile. Resources, callbacks, other non-copied signatures and Lake native C inputs remain rejected by its compiler.

The existing Alpha release and native PHP packages retain their separate paths. This record does not change their support contract or the installed type-coverage inventory. No registry publication is part of this acceptance.
