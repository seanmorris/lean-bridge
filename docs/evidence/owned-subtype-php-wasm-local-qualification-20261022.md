# PHP-Wasm owned checked-refinement qualification

Implementation: `22c1efd6c9c66c42ba438a07ca6adff6fbc7f2c5`

Ordinary Lean source and independently reviewed Binding IR each produced a
Composer API archive, npm component archive and npm shared-runtime archive.
The standalone CLI and both package routes were installed offline without their
author or build trees and physically relocated. Each route then passed eight Node and eight Chromium executions
covering embedded and Composer loading, startup and lazy initialization, and
weak and strict PHP callers on wasm32 PHP 8.4.1.

Every execution completed 119 checks. The caller exercises two selected
constructors for one proof-erased `Int` field, borrowed and transferred owned
records, rejection before ownership movement, explicit retains and closes,
garbage-collection cleanup, stale-owner rejection, zero live identities after
cleanup, and recovery on a later request. Each route also rejected 22 corrupted
package or receipt controls, reproduced its archives byte-for-byte, and verified
the receipt after removing the producer handoff.

The machine-readable [qualification record](owned-subtype-php-wasm-local-qualification-20261022.json)
pins the implementation, runtime, installed CLI, archive hashes, raw report
hash and exact route counts. The recurring workflow rebuilds the pinned runtime
and retains the complete report. PHP-Wasm callbacks, recursive owned graphs,
other predicates, dispatch counts and peak memory remain separate work.
