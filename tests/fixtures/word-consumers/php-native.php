<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use LeanWords\Sample;
use function LeanWords\{word_bits, keep_unsigned, keep_signed, unsigned_text, signed_text, advance_unsigned, advance_signed,
    keep_unsigned_values, keep_signed_values, keep_unsigned_rows, keep_signed_rows, keep_sample};
$bits = __BITS__;
$modulus = BigInteger::of(2)->power($bits);
$maximum = $modulus->minus(1);
$minimumSigned = BigInteger::of(2)->power($bits - 1)->negated()->toInt();
$maximumSigned = BigInteger::of(2)->power($bits - 1)->minus(1)->toInt();
$us = array_map(fn($value) => BigInteger::of($value), ['0', '1', '2147483648', (string)$maximum->minus(1), (string)$maximum]);
$ss = [$minimumSigned, $minimumSigned + 1, -1, 0, $maximumSigned];
$checks = 0;
function check($condition) { global $checks; if (!$condition) throw new Exception('Platform integer mismatch'); ++$checks; }
function texts($values) { return array_map(fn($v) => (string)$v, $values); }
$width = word_bits();
check(($width instanceof BigInteger ? $width->toInt() : $width) === $bits);
foreach ($us as $i => $u) {
    $s = $ss[$i];
    check(keep_unsigned($u) instanceof BigInteger && keep_unsigned($u)->isEqualTo($u));
    check(keep_signed($s) === $s);
    check(unsigned_text($u) === (string)$u);
    check(signed_text($s) === (string)$s);
    check(advance_unsigned($u)->isEqualTo($u->plus(1)->mod($modulus)));
    check(advance_signed($s) === ($s === $maximumSigned ? $minimumSigned : $s + 1));
}
foreach ([BigInteger::of(-1), $modulus, 1, '1', 1.0, true, null, []] as $bad) {
    foreach ([fn() => keep_unsigned($bad), fn() => keep_unsigned_values([$us[0], $bad]),
              fn() => keep_unsigned_rows([[$us[0]], [$bad]]),
              fn() => keep_sample(new Sample(natural: $bad, integer: -1, unsigned_values: $us, signed_values: $ss)),
              fn() => keep_sample(new Sample(natural: $us[0], integer: -1, unsigned_values: [$bad], signed_values: $ss))] as $call) {
        $rejected = false;
        try { $call(); } catch (TypeError|ValueError $error) { $rejected = true; }
        check($rejected); check(keep_signed(-1) === -1);
    }
}
foreach ([BigInteger::of($minimumSigned)->minus(1), BigInteger::of($maximumSigned)->plus(1), '1', 1.0, true, null, []] as $bad) {
    foreach ([fn() => keep_signed($bad), fn() => keep_signed_values([0, $bad]),
              fn() => keep_signed_rows([[0], [$bad]]),
              fn() => keep_sample(new Sample(natural: $us[0], integer: $bad, unsigned_values: $us, signed_values: $ss)),
              fn() => keep_sample(new Sample(natural: $us[0], integer: -1, unsigned_values: $us, signed_values: [$bad]))] as $call) {
        $rejected = false;
        try { $call(); } catch (TypeError|ValueError $error) { $rejected = true; }
        check($rejected); check(keep_unsigned($maximum)->isEqualTo($maximum));
    }
}
for ($i = 0; $i < 1000; ++$i) {
    $sample = keep_sample(new Sample(natural: $maximum, integer: $minimumSigned, unsigned_values: $us, signed_values: $ss));
    check($sample->natural->isEqualTo($maximum) && $sample->integer === $minimumSigned);
    check(texts($sample->unsigned_values) === texts($us) && $sample->signed_values === $ss);
    check(texts(keep_unsigned_values($us)) === texts($us));
    check(keep_signed_values($ss) === $ss);
    $ur = keep_unsigned_rows([$us, []]); $sr = keep_signed_rows([$ss, []]);
    check(count($ur) === 2 && texts($ur[0]) === texts($us) && $ur[1] === []);
    check($sr === [$ss, []]);
}
echo "word-ok:$checks\n";
