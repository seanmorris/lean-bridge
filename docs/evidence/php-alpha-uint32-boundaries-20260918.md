# Alpha UInt32 boundaries in PHP

Alpha's PHP-Wasm API now represents every `UInt32` as `LeanAlpha\BigInteger`. Native 64-bit PHP keeps `int`. Both profiles preserve the full unsigned range in resource constructors and reads, record fields, array elements, callback arguments and results, and returned Lean functions.

The PHP-Wasm adapter reads and writes canonical decimal text without converting through a PHP integer or float. Its generated signatures, validators, reflection and stubs use the same representation. Cross-component `LeanBeta\read` returns `BigInteger` too.

## Installed checks

`tests/fixtures/php-uint32-boundaries.php` checks `0`, `2147483647`, `2147483648` and `4294967295`. It checks concrete PHP types as well as decimal values. The oracle uses strings and explicit successor/predecessor vectors, so it cannot reproduce a 32-bit overflow by doing the same arithmetic as the implementation.

| Consumer | Strict caller | Weak caller |
| --- | ---: | ---: |
| Native PHP 8.2.33, 64-bit | 126 checks | 126 checks |
| PHP-Wasm 0.1.0 / PHP 8.4.1, lazy | 150 checks | 150 checks |
| PHP-Wasm 0.1.0 / PHP 8.4.1, startup | 150 checks | 150 checks |

The Wasm suite adds cross-component reads and rejects PHP integers, floats, numeric strings and negative zero where `UInt32` requires `BigInteger`. Both profiles reject negative and overflowing inputs, preserve the original exception from a failing callback, execute another valid call after rejection, and finish with zero live resource identities.

Alpha's count increment and returned adders use Lean's `UInt32` wraparound. The tests check both the transition from `2147483647` to `2147483648` and the transition from `4294967295` to `0`.

The native consumer installs relocated Composer files. The Wasm consumer packs and npm-installs the component and its pinned PHP-Wasm host in a temporary application. It mounts separate PHP files to exercise `strict_types=1` and `strict_types=0`; PHP-Wasm's inline `run` wrapper is not used to declare strict mode. The documentation example runs from that installation too.

CI's PHP release gate runs these consumers for native PHP and both Wasm loading profiles. Benchmarks use each profile's public representation and include conversion of known-small results into a checksum. Boundary checks run outside the measured loop.

## Parity and regression coverage

The parity corpus compares exact decimal observations. Before comparing them, it verifies reflection, assurance and documentation hashes against freshly generated expectations for each profile. It rejects altered metadata even if both packages carry the same alteration. Native and Wasm reflection and documentation need not be byte-identical because their integer types differ.

Native, startup Wasm and lazy Wasm produced semantic observation SHA-256 `da226e8f97d2a8b20835af9ea6476ee90ffd40c3d72073a0ef5a5b4c67ec67d1`. The composition check passed for both Wasm profiles using the maximum `UInt32` value. It also checked shared runtime identity and rejected conflicting runtime metadata.

The native Zend execution test still passes. The ordinary native PHP suite passed all four tests, including rebuilt Clover and Juniper packages and relocated offline Composer installations. The ordinary PHP-Wasm suite passed all five tests, including its installed Node and Chromium consumers. This leaves the ordinary copied-value API unchanged.

The generated `BigInteger` remains a decimal value wrapper, not Brick Math integration. This milestone verifies Alpha's `UInt32` API; it does not add other primitive types to Alpha or prove arbitrary callback signatures, optional values or asynchronous operations. VO1218 retains those separate type-surface tasks.

## Artifact identities

These are local acceptance artifacts, not published releases. The two Wasm archives use alternative loading profiles at the same fixture coordinate; do not publish both under that coordinate.

| Artifact | SHA-256 |
| --- | --- |
| Native release manifest | `c10215106eac67594d866ee8e4692c5aea933e1fdf12ddc3522daad764fb444c` |
| Startup Wasm release manifest | `7883d85b416db884d9759bd7d499deb719026ba8ed152752760dde6a7bf84b21` |
| Lazy Wasm release manifest | `e1e4606aee22aa680100ce83ec4e5d8728854ad4b513d7183cd38945f00cb6a6` |
| Startup `php-wasm-lean-alpha-0.0.0.tgz` | `0117137afacd082cf48aec417cd8816e44087d8f443e7476be1e6e880a1ac1ce` |
| Lazy `php-wasm-lean-alpha-0.0.0.tgz` | `bd6802bd5ba18368cb8b05a886969668a5cf5a00de6257a9f80b1b8b2fa3a59e` |

## Reproduce

Use fresh output directories:

```sh
source scripts/env.sh
node scripts/build-php-native-package.mjs --output build/alpha-boundary-native
node scripts/build-php-wasm-package.mjs \
  --php-source build/php-wasm-sdk/php8.4-src \
  --output build/alpha-boundary-wasm
node scripts/test-php-native-package-consumer.mjs --package build/alpha-boundary-native
node scripts/test-php-wasm-package-host.mjs --package build/alpha-boundary-wasm
node scripts/check-php-transport-parity.mjs \
  --native-package build/alpha-boundary-native \
  --php-wasm-package build/alpha-boundary-wasm \
  --output build/alpha-boundary-parity
```

For the complete three-profile release gate, run `npm run test:consumer:php` with its documented Nix and PHP-Wasm prerequisites.
