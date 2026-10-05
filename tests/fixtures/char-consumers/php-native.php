<?php
declare(strict_types=0);
require 'vendor/autoload.php';
use LeanGlyphs\Label;
use function LeanGlyphs\{keep, point, text, sprout, choose, keep_array, keep_label, keep_rows};

$points = [__POINTS__];
$values = array_map(fn($value) => json_decode('"\\u' . ($value <= 0xffff
    ? sprintf('%04x', $value)
    : sprintf('%04x\\u%04x', 0xd800 + (($value - 0x10000) >> 10), 0xdc00 + (($value - 0x10000) & 1023))) . '"', true, 512, JSON_THROW_ON_ERROR), $points);
$checks = 0;
function check($value) { global $checks; if (!$value) throw new Exception('Char check failed'); ++$checks; }
foreach ($values as $i => $value) {
    check(keep($value) === $value);
    $point = point($value);
    check(($point instanceof \Brick\Math\BigInteger ? $point->toInt() : $point) === $points[$i]);
    check(text($value) === $value);
    check(choose(true, $value, 'x') === $value);
    check(choose(false, 'x', $value) === $value);
    check(keep_array($values) === $values);
    $label = keep_label(new Label(marker: $value, line: $values));
    check($label->marker === $value && $label->line === $values);
    check(keep_rows([$values, [], [$value]]) === [$values, [], [$value]]);
}
check(sprout() === "🌱");
check(keep_array([]) === []);
foreach (['', 'ab', "e\u{301}", '☀️', '🇨🇦', "\xed\xa0\x80", "\xed\xbf\xbf", "\xf4\x90\x80\x80", "\xc0\x80", "\xff", 65, null, true, ['a']] as $bad) {
    foreach ([fn() => keep($bad), fn() => keep_array(['a', $bad]),
              fn() => keep_rows([['a'], [$bad]]),
              fn() => keep_label(new Label(marker: $bad, line: $values)),
              fn() => keep_label(new Label(marker: 'a', line: [$bad]))] as $call) {
        $rejected = false;
        try { $call(); } catch (TypeError|ValueError $error) { $rejected = true; }
        check($rejected);
        check(keep('🌱') === '🌱');
    }
}
for ($i = 0; $i < 1000; ++$i) check(keep_rows([$values, $values]) === [$values, $values]);
echo "char-ok:$checks\n";
