$lateBefore = $checks;
$lateNames = ['alpha', "mid\0dle", 'omega'];
$lateSavedNames = $lateNames;
$lateOffsets = [n(1), n(2), n(3)];
$lateSavedOffsets = texts($lateOffsets);
$lateSavedObjects = $lateOffsets;
for ($i = 0; $i < 3; ++$i) {
    $lateNames[$i] .= '!'; check($lateNames !== $lateSavedNames, 'name snapshot detects mutation'); $lateNames[$i] = $lateSavedNames[$i];
    $lateOffsets[$i] = $lateOffsets[$i]->plus(1); check(texts($lateOffsets) !== $lateSavedOffsets, 'offset snapshot detects mutation'); $lateOffsets[$i] = $lateSavedObjects[$i];
}
check($lateNames === $lateSavedNames, 'name controls restored');
check($lateOffsets === $lateSavedObjects && texts($lateOffsets) === $lateSavedOffsets, 'offset controls restored');
// Nine position/value combinations, then 1,000 rejection/recovery pairs.
for ($cycle = 0; $cycle < 1009; ++$cycle) {
    $position = $cycle % 3; $representation = intdiv($cycle, 3) % 3;
    $lateOffsets = [n(1), n(2), n(3)];
    $lateOffsets[$position] = $representation === 2 ? n(2)->power(70) : n(4 + $representation);
    $lateSavedOffsets = texts($lateOffsets);
    $lateSavedObjects = $lateOffsets;
    check(rejected(fn() => label($lateNames, $lateOffsets), "arg1[$position]", '4'), 'late bound diagnostic');
    check($lateNames === $lateSavedNames, 'all names unchanged after rejection');
    check($lateOffsets === $lateSavedObjects && texts($lateOffsets) === $lateSavedOffsets, 'all offsets unchanged after rejection');
    $lateOffsets = [n(1), n(2), n(3)]; $lateSavedOffsets = texts($lateOffsets); $lateSavedObjects = $lateOffsets;
    check(label($lateNames, $lateOffsets) === "alpha:1,mid\0dle:2,omega:3", 'late recovery output');
    check($lateNames === $lateSavedNames, 'all names unchanged after recovery');
    check($lateOffsets === $lateSavedObjects && texts($lateOffsets) === $lateSavedOffsets, 'all offsets unchanged after recovery');
}
check($checks - $lateBefore === 6062, 'complete late-input assertion count');
