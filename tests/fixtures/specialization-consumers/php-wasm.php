<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use function LeanSpecialized\{echo_word, echo_text, echo_nat, echo_words, choose_word, choose_text, choose_words, first_text_word, double_word, double_nat, plain};
$checks = 0;
function check($condition) { global $checks; if (!$condition) throw new Exception('Specialization mismatch'); ++$checks; }
$word = fn($value) => BigInteger::of($value);
$greeting = "h\u{e9}llo \u{1F642}";
// PHP-Wasm exposes machine words as exact BigInteger values.
check(echo_word($word(0))->isEqualTo(0) && echo_word($word('4294967295'))->isEqualTo('4294967295'));
check(echo_text($greeting) === $greeting && echo_text('') === '');
$large = BigInteger::of(2)->power(200);
check(echo_nat($large) instanceof BigInteger && echo_nat($large)->isEqualTo($large));
$words = [$word(0), $word(42), $word('4294967295')];
check(array_map('strval', echo_words($words)) === array_map('strval', $words));
foreach (['echo', 'choose', 'first', 'duplicate'] as $name) check(!function_exists('LeanSpecialized\\' . $name));
// Lean resolved each instance dictionary at build time.
check(choose_word(true, $word(5))->isEqualTo(5) && choose_word(false, $word(5))->isEqualTo(37));
check(choose_text(true, $greeting) === $greeting && choose_text(false, $greeting) === '');
check(array_map('strval', choose_words(true, $words)) === array_map('strval', $words) && choose_words(false, $words) === []);
check(double_word($word('2147483649'))->isEqualTo(2));
check(double_nat(BigInteger::of(2)->power(100))->isEqualTo(BigInteger::of(2)->power(101)));
check(first_text_word($greeting, $word(9)) === $greeting);
check(plain($word(1))->isEqualTo(4));
// Each export keeps its own concrete argument checks.
foreach ([fn() => echo_word($word('4294967296')), fn() => echo_word($word(-1)), fn() => echo_nat(BigInteger::of(-1)), fn() => echo_text([]), fn() => choose_word(null, $word(1))] as $call) {
    $rejected = false;
    try { $call(); } catch (TypeError|ValueError $error) { $rejected = true; }
    check($rejected);
}
for ($i = 0; $i < 1000; ++$i) {
    check(choose_word($i % 2 === 0, $word($i))->isEqualTo($i % 2 === 0 ? $i : 37));
    check(double_word($word($i))->isEqualTo(2 * $i));
}
echo "specialization-ok:$checks\n";
