<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use Brick\Math\BigInteger;
use function LeanSpecialized\{echo_word, echo_text, echo_nat, echo_words, choose_word, choose_text, choose_words, first_text_word, double_word, double_nat, plain};
$checks = 0;
function check($condition) { global $checks; if (!$condition) throw new Exception('Specialization mismatch'); ++$checks; }
$greeting = "h\u{e9}llo \u{1F642}";
// One generic declaration, three concrete exports; the open declaration is absent.
check(echo_word(0) === 0 && echo_word(4294967295) === 4294967295);
check(echo_text($greeting) === $greeting && echo_text('') === '');
$large = BigInteger::of(2)->power(200);
check(echo_nat($large) instanceof BigInteger && echo_nat($large)->isEqualTo($large));
$words = [0, 42, 4294967295];
check(echo_words($words) === $words);
foreach (['echo', 'choose', 'first', 'duplicate'] as $name) check(!function_exists('LeanSpecialized\\' . $name));
// Lean resolved each instance dictionary at build time.
check(choose_word(true, 5) === 5 && choose_word(false, 5) === 37);
check(choose_text(true, $greeting) === $greeting && choose_text(false, $greeting) === '');
check(choose_words(true, $words) === $words && choose_words(false, $words) === []);
check(double_word(2147483649) === 2);
check(double_nat(BigInteger::of(2)->power(100))->isEqualTo(BigInteger::of(2)->power(101)));
check(first_text_word($greeting, 9) === $greeting);
check(plain(1) === 4);
// Each export keeps its own concrete argument checks.
foreach ([fn() => echo_word(4294967296), fn() => echo_word(-1), fn() => echo_nat(BigInteger::of(-1)), fn() => echo_text([]), fn() => choose_word(null, 1)] as $call) {
    $rejected = false;
    try { $call(); } catch (TypeError|ValueError $error) { $rejected = true; }
    check($rejected);
}
for ($i = 0; $i < 1000; ++$i) {
    check(choose_word($i % 2 === 0, $i) === ($i % 2 === 0 ? $i : 37));
    check(double_word($i) === 2 * $i);
}
echo "specialization-ok:$checks\n";
