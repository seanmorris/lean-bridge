<?php
declare(strict_types=0);
require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';

use Brick\Math\BigInteger as Big;
use LeanStructured\{TreeLeaf, TreeBranch, LeanBridgeError};

$checks = 0;
function ensure(bool $value, string $label): void {
    global $checks; ++$checks;
    if (!$value) throw new RuntimeException($label);
}
$mode = MALFORMED_MODE;
$tree = new TreeBranch([new TreeLeaf(Big::of(7))]);
$copy = LeanStructured\call_recursive($tree, fn($value) => $value);
$held = LeanStructured\make_recursive($tree);
ensure(recursive_probe_stats()['identities'] === 1, 'live closure before malformed result');
recursive_probe_poison($mode);
$caught = null;
try {
    $mode === 5 ? LeanStructured\make_recursive($tree)
        : LeanStructured\call_recursive($tree, fn($value) => $value);
} catch (LeanBridgeError $error) { $caught = $error; }
ensure($caught !== null && $caught->getCode() === ($mode === 3 ? 5 : 4), 'malformed result status');
$stats = recursive_probe_stats();
ensure($stats['poisoned'] === 1, 'one deliberately malformed native result');
ensure($stats['retirements'] === ($mode === 3 ? 0 : 1), 'one retirement request');
ensure($stats['nativeLive'] === 0, 'malformed native owner cleared');
ensure($stats['identities'] === 1, 'held closure remains owned before close');
foreach ([fn() => LeanStructured\make_recursive($tree), fn() => $held(true, $tree),
    fn() => LeanStructured\call_recursive($tree, fn($value) => $value)] as $operation) {
    try { $operation(); throw new RuntimeException('malformed_output_retires_runtime'); }
    catch (LeanBridgeError $error) { ensure($error->getCode() === 5, 'retired runtime status'); }
}
$held->close(); $held->close(); ensure($held->isClosed(), 'close allowed after retirement');
ensure($copy->equals($tree), 'copied values survive retirement');
unset($held, $caught, $error, $operation); gc_collect_cycles();
$stats = recursive_probe_stats();
ensure($stats['nativeLive'] === 0, 'no native buffers');
ensure($stats['zendLive'] === 0, 'no Zend scratch or resources');
ensure($stats['identities'] === 0, 'no live closure identities');
ensure($stats['closes'] === 1, 'exactly one owned close');
echo json_encode(['mode' => $mode, 'checks' => $checks, 'actualPhpBits' => PHP_INT_SIZE * 8,
    'compiledLean' => true, 'installedPackage' => false, 'stats' => $stats], JSON_THROW_ON_ERROR);
