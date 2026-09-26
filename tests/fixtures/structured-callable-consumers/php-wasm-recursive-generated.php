$tree = new TreeLeaf(Big::of(7));
$recurse = static function($value, int $depth) use (&$recurse) {
    return $depth === 0 ? $value : LeanStructured\call_recursive($value, static fn($inner) => $recurse($inner, $depth - 1));
};
check(equal($recurse($tree, 8), $tree));
reject(OverflowException::class, fn() => $recurse($tree, 80));
check(equal($recurse($tree, 8), $tree));
$payload = values(0)[5]; $called = 0;
$borrowed = static function($value) use (&$called) { ++$called; return $value; };
$retained = LeanStructured\retain_record($borrowed); check($called === 0);
check(reject(LeanStructured\LeanBridgeError::class, fn() => $retained($payload))->getCode() !== 0);
check($called === 0); $retained->close();
$error = new Error('Exact first failure'); $thrower = static function() use ($error) { throw $error; };
check(reject(Error::class, fn() => LeanStructured\after_failure($payload, $thrower)) === $error);
check(equal(LeanStructured\call_recursive($tree, fn($value) => $value), $tree));
// The pinned host cannot start Fibers: its getcontext hook is absent. The
// separate native-PHP wrapper test executes the actual Fiber entry guard.
$lease = LeanStructured\make_recursive($tree); check(Fiber::getCurrent() === null);
$lease->close(); check($lease->isClosed());
$closed = recursive_probe_stats()['closes'];
$abandoned = LeanStructured\make_recursive($tree); unset($abandoned); gc_collect_cycles();
check(recursive_probe_stats()['closes'] === $closed + 1);
unset($lease, $retained); gc_collect_cycles();
$stats = recursive_probe_stats();
check($stats['nativeLive'] === 0); check($stats['zendLive'] === 0); check($stats['identities'] === 0);

$faults = [];
$inputs = values(2); $replies = values(3);
foreach ($shapes as $index => $shape) {
    $function = 'LeanStructured\\twice_' . $shape;
    $input = $inputs[$index]; $reply = $replies[$index];
    $operation = static fn() => $function($input, static fn($value) => $reply);
    foreach ([1 => 'native', 2 => 'zend'] as $phase => $label) {
        $GLOBALS['faultContext'] = ['shape' => $shape, 'allocator' => $label, 'point' => 0];
        recursive_probe_reset(0, 0);
        check(equal($operation(), $reply));
        $attempts = recursive_probe_stats()[$label . 'Attempts'];
        // Inline Option Unit has no native heap allocation to inject into.
        check($attempts > 0 || ($phase === 1 && $shape === 'option'));
        for ($point = 1; $point <= $attempts; ++$point) {
            $GLOBALS['faultContext']['point'] = $point;
            recursive_probe_reset($phase, $point);
            $failure = reject(Throwable::class, $operation);
            check($failure instanceof Error || $failure instanceof LeanStructured\LeanBridgeError);
            if ($failure instanceof LeanStructured\LeanBridgeError) check(in_array($failure->getCode(), [3, 6], true));
            $stats = recursive_probe_stats();
            // An exception trace may retain the closed Zend resource argument.
            // The native identity must already be gone while that trace lives.
            check($stats['nativeLive'] === 0); check($stats['identities'] === 0);
            unset($failure); gc_collect_cycles(); $stats = recursive_probe_stats();
            $GLOBALS['faultContext']['stats'] = $stats;
            check($stats['nativeLive'] === 0); check($stats['zendLive'] === 0); check($stats['identities'] === 0);
            recursive_probe_reset(0, 0);
            check(equal($operation(), $reply));
        }
        $faults[$shape][$label] = $attempts;
    }
}
recursive_probe_reset(0, 0);
$ownedFaults = [];
foreach ($shapes as $index => $shape) {
    $make = 'LeanStructured\\make_' . $shape;
    $input = $inputs[$index]; $reply = $replies[$index];
    // Use the nonempty captured branch, except Result whose Err reply owns
    // strings. Empty Array/List/Tree replies correctly make no native copy.
    $selected = $shape !== 'result'; $expected = $selected ? $input : $reply;
    $operation = static function() use ($make, $input, $reply, $selected) {
        $owned = $make($input);
        try { return $owned($selected, $reply); }
        finally { $owned->close(); }
    };
    foreach ([1 => 'native', 2 => 'zend'] as $phase => $label) {
        $GLOBALS['faultContext'] = ['shape' => $shape, 'owned' => true, 'allocator' => $label, 'point' => 0];
        recursive_probe_reset(0, 0);
        check(equal($operation(), $expected));
        $attempts = recursive_probe_stats()[$label . 'Attempts'];
        check($attempts > 0 || ($phase === 1 && $shape === 'option'));
        for ($point = 1; $point <= $attempts; ++$point) {
            $GLOBALS['faultContext']['point'] = $point;
            recursive_probe_reset($phase, $point);
            $failure = reject(Throwable::class, $operation);
            check($failure instanceof Error || $failure instanceof LeanStructured\LeanBridgeError);
            if ($failure instanceof LeanStructured\LeanBridgeError) check(in_array($failure->getCode(), [3, 6], true));
            $stats = recursive_probe_stats();
            check($stats['nativeLive'] === 0); check($stats['identities'] === 0);
            unset($failure); gc_collect_cycles(); $stats = recursive_probe_stats();
            $GLOBALS['faultContext']['stats'] = $stats;
            check($stats['nativeLive'] === 0); check($stats['zendLive'] === 0); check($stats['identities'] === 0);
            recursive_probe_reset(0, 0);
            check(equal($operation(), $expected));
        }
        $ownedFaults[$shape][$label] = $attempts;
    }
}
recursive_probe_reset(0, 0); unset($GLOBALS['faultContext']);

// Private resource probes never expose a native uint64 identity to a PHP int.
$old = LeanStructured\make_recursive($tree);
$internal = (new ReflectionProperty(LeanClosure::class, 'lease'))->getValue($old);
$token = (new ReflectionProperty($internal, 'token'))->getValue($internal);
$invoke = (new ReflectionProperty($internal, 'invoke'))->getValue($internal);
check(is_resource($token));
$old->close(); $fresh = LeanStructured\make_recursive($tree);
reject(TypeError::class, fn() => $invoke($token, [true, $tree]));
check(equal($fresh(true, $tree), $tree));
$other = LeanStructured\make_array([]);
$otherInternal = (new ReflectionProperty(LeanClosure::class, 'lease'))->getValue($other);
$otherToken = (new ReflectionProperty($otherInternal, 'token'))->getValue($otherInternal);
reject(TypeError::class, fn() => $invoke($otherToken, [true, $tree]));
$stream = fopen('php://memory', 'r+');
reject(TypeError::class, fn() => $invoke($stream, [true, $tree])); fclose($stream);
check(equal($fresh(true, $tree), $tree));
$fresh->close(); $other->close();
unset($old, $fresh, $other, $internal, $otherInternal, $token, $otherToken, $invoke);
gc_collect_cycles();
check(recursive_probe_stats()['zendLive'] === 0); check(recursive_probe_stats()['identities'] === 0);

$held = [];
try {
    for ($index = 0; $index < 4096; ++$index) $held[] = LeanStructured\make_recursive($tree);
    check(recursive_probe_stats()['identities'] === 4096);
    check(reject(LeanStructured\LeanBridgeError::class, fn() => LeanStructured\make_recursive($tree))->getCode() === 3);
    check(equal($held[0](true, $tree), $tree)); check(equal($held[4095](true, $tree), $tree));
} finally { foreach ($held as $owned) $owned->close(); }
unset($held, $owned); gc_collect_cycles();
check(recursive_probe_stats()['zendLive'] === 0); check(recursive_probe_stats()['identities'] === 0);
for ($index = 0; $index < 8192; ++$index) {
    $owned = LeanStructured\make_recursive($tree);
    check(equal($owned(true, $tree), $tree)); $owned->close();
}
unset($owned); gc_collect_cycles();
check(recursive_probe_stats()['nativeLive'] === 0); check(recursive_probe_stats()['zendLive'] === 0);
check(recursive_probe_stats()['identities'] === 0);
echo json_encode(['checks' => $checks, 'compiledLean' => true, 'installedPackage' => false,
    'actualPhpBits' => PHP_INT_SIZE * 8, 'fiberStartAvailable' => false,
    'faults' => $faults, 'ownedFaults' => $ownedFaults, 'capacity' => 4096, 'recovered' => 8192,
    'foreignResourceRejected' => true, 'closedResourceRejected' => true, 'wrongSignatureRejected' => true,
    'stats' => recursive_probe_stats()], JSON_THROW_ON_ERROR);
