<?php
declare(strict_types=0);
use Brick\Math\BigInteger;
use LeanSubtypes\Bytes;
use LeanSubtypes\LeanBridgeError;
use function LeanSubtypes\{shout, half, scale, head, pad, join, clamp, mix};
$checks = 0;
function check($condition, $label) { global $checks; if (!$condition) throw new Exception('failed: ' . $label); ++$checks; }
function n($value) { return BigInteger::of($value); }
function rejected(callable $call, string $message): bool {
    try { $call(); }
    catch (LeanBridgeError $error) { return $error->getCode() === 1 && $error->getMessage() === $message; }
    return false;
}
function throwsType(string $type, callable $call): bool {
    try { $call(); } catch (Throwable $error) { return $error instanceof $type; }
    return false;
}
$hello = "h\u{e9}llo \u{1F642}";
// Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected.
check(shout($hello) === "$hello!" && shout("a\0b") === "a\0b!", 'shout');
check(rejected(fn() => shout(''), 'arg0 was rejected by Subtypes.checkedWord'), 'empty word');
check(throwsType(TypeError::class, fn() => shout(3)), 'non-string is TypeError');
// Even Nat beyond 64 bits.
check(half(n(42))->isEqualTo(21) && half(n(2)->power(100))->isEqualTo(n(2)->power(99)), 'half');
check(rejected(fn() => half(n(7)), 'arg0 was rejected by Subtypes.checkedEven'), 'odd');
check(throwsType(ValueError::class, fn() => half(n(-2))), 'negative is the Nat ValueError');
// Small Int after an unchecked argument.
check(scale(n(-3), n(-128))->isEqualTo(384) && scale(n(-3), n(127))->isEqualTo(-381), 'scale');
check(rejected(fn() => scale(n(-3), n(128)), 'arg1 was rejected by Subtypes.checkedSmall') && rejected(fn() => scale(n(-3), n(-129)), 'arg1 was rejected by Subtypes.checkedSmall'), 'late rejection');
// Nonempty ByteArray.
check(head(Bytes::fromString("\0\xff")) === 0, 'head');
check(rejected(fn() => head(Bytes::fromString('')), 'arg0 was rejected by Subtypes.checkedPayload'), 'empty payload');
// A result-only subtype and two checked arguments.
check(pad(n(21))->isEqualTo(42) && join('ab', 'cd') === 'abcd', 'pad and join');
check(rejected(fn() => join('ab', ''), 'arg1 was rejected by Subtypes.checkedWord') && rejected(fn() => join('', 'cd'), 'arg0 was rejected by Subtypes.checkedWord'), 'join rejections');
// A normalizing constructor: the export sees the constructed value.
check(clamp(n(250))->isEqualTo(100) && clamp(n(7))->isEqualTo(7), 'clamp');
// A checked constructor beside a Fin bound: the Fin precheck runs first.
check(mix(n(4), n(3))->isEqualTo(7), 'mix');
check(rejected(fn() => mix(n(4), n(10)), 'arg1 is not below its Fin 10 bound') && rejected(fn() => mix(n(5), n(10)), 'arg1 is not below its Fin 10 bound'), 'Fin before the constructor');
check(rejected(fn() => mix(n(5), n(3)), 'arg0 was rejected by Subtypes.checkedEven'), 'odd beside a valid digit');
for ($i = 0; $i < 1000; ++$i) {
    if (!rejected(fn() => half(n(2 * $i + 1)), 'arg0 was rejected by Subtypes.checkedEven')) throw new Exception('invalid call accepted at ' . $i);
    if (!half(n(2 * $i))->isEqualTo($i)) throw new Exception('valid call failed at ' . $i);
}
// Distinct checked and normalizing constructors for one generic, plus a scalar base and a zero-argument result.
check(\LeanSubtypes\byte(255) === 255, 'nonzero byte');
check(rejected(fn() => \LeanSubtypes\byte(0), 'arg0 was rejected by Subtypes.checkedByte'), 'zero byte');
check(\LeanSubtypes\first_even(n(6))->isEqualTo(6), 'checked specialization');
check(rejected(fn() => \LeanSubtypes\first_even(n(7)), 'arg0 was rejected by Subtypes.checkedEven'), 'specialized rejection');
$unchanged = n(7);
check(\LeanSubtypes\second_even($unchanged)->isEqualTo(14) && $unchanged->isEqualTo(7), 'normalized specialization retains input');
$huge = n(2)->power(100);
check(\LeanSubtypes\second_even($huge)->isEqualTo(n(2)->power(101)) && $huge->isEqualTo(n(2)->power(100)), 'wide normalization retains input');
check(\LeanSubtypes\zero_even()->isEqualTo(0), 'zero-argument result');
$word = "unchanged";
check(rejected(fn() => join($word, ''), 'arg1 was rejected by Subtypes.checkedWord') && $word === 'unchanged', 'late heap rejection retains input');
$checks += 2000;
echo json_encode(['checks' => $checks, 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
