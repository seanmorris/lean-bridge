<?php
declare(strict_types=1);
// Host-only value semantics. No Lean call, private converter or native layout.
require __DIR__ . '/dependencies/brick-math/autoload.php';
foreach (['collections', 'compounds', 'lists', 'aliases', 'variants'] as $package) require __DIR__ . '/' . $package . '/src/Api.php';
use Brick\Math\BigInteger;
use LeanCollections\{Primitives, Pair, Reversed, Empty_, Single, Count, Packet};
$checks = 0; $rejections = 0; $width = (int) $argv[1];
function check(bool $value): void { global $checks; ++$checks; if (!$value) throw new RuntimeException("Equality assertion $checks"); }
function equal(object $left, object $right): void {
    check($left !== $right); check($left->equals($left)); check($left->equals($right)); check($right->equals($left));
    check(!$left->equals(null)); check(!$left->equals('foreign'));
    check($left->hashCode() === $right->hashCode()); check(preg_match('/^[0-9a-f]{64}$/D', $left->hashCode()) === 1);
    $map = [$left->hashCode() => 'found']; check($map[$right->hashCode()] === 'found');
}
function different(object $left, object $right): void { check(!$left->equals($right)); check(!$right->equals($left)); }
function reject(callable $call, string $kind): void {
    global $rejections;
    try { $call(); } catch (Throwable $error) { check($error instanceof $kind); ++$rejections; return; }
    throw new RuntimeException('Missing ' . $kind);
}
$big = fn($value) => BigInteger::of((string) $value);
$u32 = fn(int $value) => $width === 32 ? $big($value) : $value;
$i64 = fn(int $value) => $width === 32 ? $big($value) : $value;
$huge = $big(2)->power(5120)->plus(17);
foreach (['LeanCompounds', 'LeanLists', 'LeanAliases', 'LeanVariants'] as $namespace) {
    $some = $namespace . '\\Some'; $ok = $namespace . '\\Ok'; $err = $namespace . '\\Err'; $bytes = $namespace . '\\Bytes';
    foreach ([null, false, true, 0, 1, -1, 0.0, -0.0, INF, -INF, NAN, '', '0', '01', "\0🌿", $huge, $huge->negated(), $bytes::fromString("\0\xff"), [], [null], [[1, 2], [], [3]]] as $value)
        foreach ([$some, $ok, $err] as $class) equal(new $class($value), new $class($value));
    foreach ([[false, 0], [null, false], [0, 0.0], ['0', 0], ['1', '01'], [0.0, -0.0], [[], [null]], [$big(1), 1]] as [$left, $right])
        different(new $some($left), new $some($right));
    equal(new $some(NAN), new $some(unpack('E', hex2bin('7ff8000000001234'))[1]));
    different(new $some(null), new $some(new $some(null)));
    different(new $ok(null), new $err(null)); different(new $some(null), new $ok(null));
    $left = new $some('1'); $right = new $some('01'); check($left == $right); different($left, $right);
    for ($depth = 0; $depth <= 24; ++$depth) {
        $value = ["a\0🌿", $huge, $bytes::fromString("\0\xff")];
        for ($i = 0; $i < $depth; ++$i) $value = [$value];
        equal(new $some($value), new $some($value));
    }
    $cycle = []; $cycle[] = &$cycle;
    $value = new $some($cycle);
    reject(fn() => $value->equals($value), ValueError::class); reject(fn() => $value->hashCode(), ValueError::class);
    unset($value, $cycle); gc_collect_cycles();
    $value = new $some(['not-a-list' => 1]);
    reject(fn() => $value->equals($value), TypeError::class); reject(fn() => $value->hashCode(), TypeError::class);
    $value = new $some(new stdClass());
    reject(fn() => $value->equals($value), TypeError::class); reject(fn() => $value->hashCode(), TypeError::class);
    $value = (new ReflectionClass($some))->newInstanceWithoutConstructor();
    reject(fn() => $value->equals($value), TypeError::class); reject(fn() => $value->hashCode(), TypeError::class);
    $stream = fopen('php://memory', 'r+'); $value = new $some($stream);
    reject(fn() => $value->equals($value), TypeError::class); reject(fn() => $value->hashCode(), TypeError::class);
    fclose($stream);
    reject(fn() => $value->equals($value), TypeError::class); reject(fn() => $value->hashCode(), TypeError::class);
    $value = new $some(str_repeat('x', 16 * 1024 * 1024));
    reject(fn() => $value->equals($value), ValueError::class); reject(fn() => $value->hashCode(), ValueError::class);
    unset($value);
    equal($bytes::fromString("a\0\xff"), $bytes::fromString("a\0\xff"));
    different($bytes::fromString('1'), $bytes::fromString('01'));
}
equal(new Empty_(), new Empty_());
equal(new Single($huge->mod('18446744073709551616')), new Single($huge->mod('18446744073709551616')));
equal(new Count($huge), new Count($huge)); different(new Single($big(1)), new Count($big(1)));
equal(new Pair($u32(42), "ok\0"), new Pair($u32(42), "ok\0"));
different(new Pair($u32(42), '1'), new Pair($u32(42), '01'));
different(new Pair($u32(42), 'text'), new Reversed('text', $u32(42)));
$primitive = fn(float $f32, string $text) => new Primitives(null, true, 255, 65535, $u32(4294967295), $big('18446744073709551615'),
    -128, -32768, -2147483648, $i64(PHP_INT_MIN), $huge, $huge->negated(), $f32, 3.25, $text,
    LeanCollections\Bytes::fromString("\0\xff"), '🌿', $width === 32 ? $big(4294967295) : $big('18446744073709551615'), -2147483648);
for ($i = 0; $i < 128; ++$i) {
    $value = $primitive(-0.0, "a\0🌿" . $i); $copy = $primitive(-0.0, "a\0🌿" . $i);
    equal($value, $copy); different($value, $primitive(0.0, "a\0🌿" . $i));
    $packet = fn(Primitives $p) => new Packet('map', [[$p], [], [$p, $p]], new Empty_(), new Single($big(9)), new Count($huge), new Pair($u32(42), 'p'), new Reversed('r', $u32(24)));
    equal($packet($value), $packet($copy)); different($packet($value), $packet($primitive(-0.0, 'changed')));
}
equal($primitive(NAN, 'same'), $primitive(NAN, 'same'));
equal(new LeanVariants\SignalData($u32(42), "λ\0"), new LeanVariants\SignalData($u32(42), "λ\0"));
different(new LeanVariants\SignalIdle(), new LeanVariants\SignalStopped());
different(new LeanVariants\SignalIdle(), new LeanVariants\SignalMarker(null));
equal(new LeanVariants\SignalMarker(null), new LeanVariants\SignalMarker(null));
echo json_encode(['checks' => $checks, 'rejections' => $rejections, 'projections' => 5, 'nativeCalls' => 0], JSON_THROW_ON_ERROR) . "\n";
