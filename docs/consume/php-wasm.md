# PHP-Wasm

Run the generated `LeanAlpha` PHP API inside a Node-hosted PHP 8.4 runtime. The npm package supplies the Lean runtime, component side modules, PHP extension, Composer sources, and loader metadata.

## Use a prepared release

### Prerequisites

Use Node 22 and npm with `php-wasm` version `0.1.0`. This guide selects PHP `8.4`, the version covered by the PHP-Wasm consumer profile. Browser-hosted PHP and other PHP versions need separate acceptance work.

The application uses a completed package and needs no Emscripten or PHP compiler.

### Obtain and install the package

Request the Alpha npm archive `php-wasm-lean-alpha@0.0.0`. [Authenticate the archive](receive-package.md) before installation. The lazy and startup builds share the npm coordinate but have distinct archive subjects and graph profiles in their release receipts. Choose one profile and verify its exact archive.

The following commands expect an authenticated archive at an absolute path:

```sh
export LEAN_ALPHA_PHP_WASM_ARCHIVE=/absolute/path/to/php-wasm-lean-alpha-0.0.0.tgz
mkdir lean-alpha-php-wasm-example
cd lean-alpha-php-wasm-example
```

Create `package.json`:

```json file=php-wasm/package.json
{
  "name": "lean-alpha-php-wasm-example",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node main.mjs"
  }
}
```

Install the exact host version and the archive, with lifecycle scripts disabled:

```sh
npm install --save-exact --ignore-scripts --no-audit --no-fund \
  php-wasm@0.1.0 "$LEAN_ALPHA_PHP_WASM_ARCHIVE"
```

Keep the resulting lockfile with your application.

### Write the PHP program

Save this as `main.php`:

```php file=php-wasm/main.php
<?php
declare(strict_types=1);

require_once '/vendor/autoload.php';

use LeanAlpha\Box;
use LeanAlpha\Bytes;
use LeanAlpha\Payload;
use function LeanAlpha\makeAdder;
use function LeanAlpha\roundTrip;
use function LeanAlpha\withCallback;

$box = new Box(41);
$addTwo = null;
try {
    $payload = roundTrip(new Payload(
        false, 8, 'consumer', Bytes::fromString("\x00\x7f\xff"), [1, 5, 13],
    ));
    $addTwo = makeAdder(2);
    $result = [
        'box' => $box->read(),
        'identity' => $box->identity() === $box,
        'payload' => [
            $payload->enabled, $payload->count, $payload->label,
            bin2hex($payload->bytes->toString()), $payload->values,
        ],
        'callback' => withCallback(40, static fn(int $value): int => $value),
        'closure' => $addTwo(40),
    ];
    $expected = [
        'box' => 41,
        'identity' => true,
        'payload' => [true, 9, 'consumer', '007fff', [1, 5, 13]],
        'callback' => 42,
        'closure' => 42,
    ];
    if ($result !== $expected) {
        throw new RuntimeException('Lean Alpha returned an unexpected result');
    }
    echo json_encode($result, JSON_THROW_ON_ERROR), PHP_EOL;
} finally {
    try {
        $addTwo?->close();
    } finally {
        $box->close();
    }
}
```

The package loader places its Composer files in PHP's virtual filesystem. `/vendor/autoload.php` belongs to that filesystem, not the Node process's host filesystem.

### Start the host and capture output

Save this as `main.mjs`:

```js file=php-wasm/main.mjs
/**
 * Runs the Alpha PHP program inside the installed PHP-Wasm host.
 *
 * @file
 */

import { readFile } from "node:fs/promises";
import { PhpNode } from "php-wasm/PhpNode";
import leanAlpha from "php-wasm-lean-alpha";

const php = new PhpNode({ version: "8.4", sharedLibs: [leanAlpha] });
let stdout = "";
let stderr = "";
php.addEventListener("output", event => {
	for(const chunk of event.detail) stdout += chunk;
});
php.addEventListener("error", event => {
	for(const chunk of event.detail) stderr += chunk;
});

await php.binary;
const source = await readFile(new URL("./main.php", import.meta.url), "utf8");
await php.writeFile("/main.php", source);
const status = await php.run("<?php require '/main.php';");
if(status !== 0 || stderr !== "")
{
	throw new Error(`PHP failed with status ${status}: ${stderr || stdout}`);
}
process.stdout.write(stdout.endsWith("\n") ? stdout : `${stdout}\n`);
```

Run it:

```sh
npm start --silent
```

Expected output:

```json
{"box":41,"identity":true,"payload":[true,9,"consumer","007fff",[1,5,13]],"callback":42,"closure":42}
```

Register the output listeners before awaiting initialization. `php.run()` returns an exit status; its return value does not contain the PHP output.

The host copies `main.php` into PHP's virtual filesystem and requires it as a file. This preserves PHP's `strict_types` declaration; passing the entire file directly to `php.run()` places it inside the host's evaluation wrapper.

### Types, ownership, and errors

PHP-Wasm exposes the same copied `Payload`, binary `Bytes`, canonical `Box` identity, PHP callbacks, and invokable Lean closures as [native PHP](php-native.md#types-ownership-and-errors). Alpha changes the record's Boolean and count; the callback and returned callable each produce `42` in this example.

The `finally` blocks close the returned callable and the box even when a call fails. Closing a resource twice is allowed; using a closed wrapper raises `LeanAlpha\DisposedResource`. Keep each resource in the PHP-Wasm instance that created it. A second instance owns a separate Lean heap and identity domain.

Handle both JavaScript initialization failures and PHP failures. The host example throws on a nonzero PHP exit status or PHP error output. Explicit PHP comparisons keep the example's checks active when assertions are disabled.

### Troubleshooting

- **The process prints nothing:** add the `output` listener and forward the captured text as above. Waiting for `php.run()` alone does not print PHP output.
- **The extension or a side module fails to load:** use PHP `8.4`, `php-wasm@0.1.0`, and the complete generated package. Do not mix assets from lazy and startup archives.
- **The autoloader is missing:** pass the imported descriptor in `sharedLibs` before awaiting `php.binary`. Node's `vendor/` directory is not PHP's virtual `/vendor/` directory.

## Start from a raw Lean package

For Alpha, follow the [PHP-Wasm package build](../publish/npm.md#publish-the-php-wasm-profile) with its pinned PHP source and Emscripten environment. Build and pack the selected lazy or startup profile, then install that completed archive using the [prepared release steps](#use-a-prepared-release). Local build and pack commands do not require uploading it.

For another Lean library, check the [source workflow and supported targets](../consume.md#start-from-a-raw-lean-package). These Alpha builds use the repository's target-specific inputs.

### Acceptance checks

Contributors run these files through the [installed consumer checks](../contributing/testing.md#consumer-acceptance). See the [PHP release evidence](../evidence/php-release-gate.md) for package reproducibility, callbacks, closures, and identity cleanup.

### Publish this package

See [Publish the PHP-Wasm npm package](../publish/npm.md#publish-the-php-wasm-profile) for package preparation, distribution, and verification after upload.
