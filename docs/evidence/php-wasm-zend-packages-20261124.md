# Install PHP class bindings for a compiled Lean worker

The author installs the Lean Bridge CLI from its npm archive and builds a PHP-Wasm release. The PHP application calls `withHosts(['Box' => AppBox::class])`. It supplies its own class, not a dispatcher or a JavaScript mirror. The [application](../../tests/fixtures/php-wasm-task-owner/zend-installed.php) uses a second, independently compiled package on the same Lean heap.

| Installed check | Observation |
| --- | --- |
| Constructor, static factory, property and overridden method | The peer reads and mutates the original PHP object, including a subclass. A conflicting class table is refused without invalidating the live binding. |
| Immediate reentry and retained worker callbacks | A member can call another member. A callback can await a peer task and return its original object to the first worker. A synchronous member cannot wait; its rejected wait leaves the task usable. |
| Failure channels | A returned `Except.error` remains a value. Factory and worker failures throw at their declared phase. A cursor step can throw a typed error carrying the original PHP object. A propagated PHP exception retains its identity. |
| Binding lifetime | A task and cursor each keep a temporary binding alive. Closing from that binding's own active callback is rejected. Closing outside the callback cancels pending work, releases the PHP input roots, and leaves sibling bindings usable. Breaking out of iteration releases the cursor. |
| Two PHP interpreters, one compiled component | While one Node-hosted interpreter has a parked callback, a second binds the same nominal type to a different PHP class, runs its own callback, and closes. The first then resumes and sees its own object and method result. |

The [package test](../../tests/helpers/php-wasm-zend-packages.mjs) builds ordinary and reviewed releases of Workshop and a separate Sidekick release. The reviewed route has no selected export list; its checked public interface must equal the ordinary route's. The CLI verifies all three receipts. Each includes a Composer API, an npm component, and the same npm runtime. The consumer installs offline, removes its feed, moves its installation, then runs in Node with both autoloaders and in isolated Chromium with the embedded API. The healthy runs assert zero live runtime frames, allocations, pending operations, notifications and native owners. These are local installed packages, not registry publications or hosted CI.

The [archive fingerprints](php-wasm-zend-packages-20261124.json) identify the CLI, SDK, Lean source trees, side modules, and installed package sets. In a separate Node interpreter for each author route, the [fault fixture](../../tests/fixtures/php-wasm-task-owner/zend-trap.php) throws a PHP engine `Error` while a second component owns an unobserved worker. The originating task delivers the same error object. The peer refuses new work and reports a failed drain, but still releases its input before returning from `close()`. This does not claim that a dead heap ran native finalizers.

## Checking the original Zend object in each position

The [ordinary](zend-host-object-positions-20261126/ordinary.json) and
[reviewed](zend-host-object-positions-20261126/reviewed.json) clients used the
original [threaded Workshop and Sidekick archives](zend-host-closures-20261125.md#threaded-php-wasm).
The [PHP application](../../tests/fixtures/php-wasm-task-owner/zend-installed.php)
checks that `same_box` immediately returns each input object. Its first
callback compares its argument with the caller's original instance using
`===`; it then returns a distinct subclass instance from a nested Sidekick
call. The second callback checks that it received precisely that subclass
instance, and so does the caller when the future settles.

The same application ran through embedded autoloading and Composer in Node,
and through embedded autoloading in isolated Chromium. All six executions
reported zero live owners. A separate interpreter per route checked that a
callback trap survives and the peer refuses new work. The
[record client](php-wasm-host-record-fields-20261126.md) checks the fifth
position separately. To replay these archives, set
`LEAN_BRIDGE_PHP_ZEND_PACKAGE_REPLAY` to the directory containing the
three handoffs and run `npm run test:php-wasm-zend-packages`. Set
`LEAN_BRIDGE_PHP_ZEND_OBJECT_OUTPUT` to retain the per-route results.

## Reproduce

Use the matching Lean and Emscripten tools and the [PHP-Wasm host setup](php-wasm-retained-callback-packages-20261124.md#reproduce). Set `LEAN_BRIDGE_TEST_TASK_INPUTS` to the verified pthread SDK that includes synchronous Zend member dispatch, `LEAN_BRIDGE_PHP_WASM_HOST` to the installed `php-wasm` package, and `LEAN_BRIDGE_CHROMIUM` if Chromium is not discoverable. Run `npm run test:php-wasm-zend-packages`. To retain the handoffs, set `LEAN_BRIDGE_PHP_ZEND_PACKAGE_OUTPUT` to an existing directory with free space.
