// Appended to the common weak/strict public-value fixture in a fresh interpreter.
$contextChecks = recursive_probe_contexts(0);
check($contextChecks === 3 * CALLBACK_COUNT);
$inputs = values(2);
foreach ($shapes as $index => $shape) {
    $call = 'LeanStructured\\call_' . $shape; $input = $inputs[$index]; $called = 0;
    $reply = $call($input, static function($value) use (&$called, &$contextChecks) {
        ++$called;
        $tested = recursive_probe_contexts(1); check($tested === CALLBACK_COUNT - 1);
        $contextChecks += $tested;
        return $value;
    });
    check($called === 1 && equal($reply, $input));
    $tested = recursive_probe_contexts(2); check($tested === CALLBACK_COUNT);
    $contextChecks += $tested;
}
check(recursive_probe_stats()['contextChecks'] === $contextChecks);

function privateLease(LeanClosure $closure): array {
    $internal = (new ReflectionProperty(LeanClosure::class, 'lease'))->getValue($closure);
    $token = (new ReflectionProperty($internal, 'token'))->getValue($internal);
    return [$internal, $token];
}
$tree = new TreeLeaf(Big::of(7));
$old = LeanStructured\make_recursive($tree);
[$oldInternal, $oldToken] = privateLease($old);
check(recursive_probe_lease($oldToken, 0)); $old->close();
$fresh = LeanStructured\make_recursive($tree);
[$freshInternal, $freshToken] = privateLease($fresh);
check(recursive_probe_lease($freshToken, 1) === 6);
check(equal($fresh(true, $tree), $tree));
$fresh->close();
unset($old, $oldInternal, $oldToken, $fresh, $freshInternal, $freshToken);
gc_collect_cycles();
check(recursive_probe_stats()['identities'] === 0);
check(recursive_probe_stats()['zendLive'] === 0);

// Insert a PHP observer before the real private downcall. The actual owned
// Zend resource must survive close() until the public invocation unwinds.
$activeClose = 0;
foreach ([false, true] as $throw) {
    $lease = LeanStructured\make_recursive($tree);
    [$internal, $token] = privateLease($lease);
    $property = new ReflectionProperty($internal, 'invoke'); $invoke = $property->getValue($internal);
    $before = recursive_probe_stats()['closes']; $failure = new Error('Active close first failure');
    $property->setValue($internal, static function($token, $arguments) use ($lease, $before, $invoke, $throw, $failure) {
        $lease->close(); $lease->close(); check($lease->isClosed());
        check(recursive_probe_stats()['closes'] === $before);
        check(recursive_probe_stats()['identities'] === 1);
        $result = $invoke($token, $arguments);
        if ($throw) throw $failure;
        return $result;
    });
    if ($throw) check(reject(Error::class, fn() => $lease(true, $tree)) === $failure);
    else check(equal($lease(true, $tree), $tree));
    check(recursive_probe_stats()['closes'] === $before + 1);
    check(recursive_probe_stats()['identities'] === 0);
    reject(LogicException::class, fn() => $lease(true, $tree));
    unset($lease, $internal, $token, $property, $invoke, $failure); gc_collect_cycles();
    check(recursive_probe_stats()['zendLive'] === 0); ++$activeClose;
}

// Exhaust a fresh process's uintptr identities. No reset or wraparound is
// permitted, but unrelated owned Lean closures remain usable.
recursive_probe_contexts(3); $lastCalls = 0;
check(equal(LeanStructured\call_recursive($tree, static function($value) use (&$lastCalls) {
    ++$lastCalls; return $value;
}), $tree));
check($lastCalls === 1 && recursive_probe_stats()['contextsExhausted']);
for ($attempt = 0; $attempt < 3; ++$attempt) {
    $error = reject(ValueError::class, fn() => LeanStructured\call_recursive($tree, fn($value) => $value));
    check(str_contains($error->getMessage(), 'context identities exhausted'));
    unset($error); gc_collect_cycles();
    check(recursive_probe_stats()['borrowedContexts'] === 0);
    check(recursive_probe_stats()['callDepth'] === 0);
}
$lease = LeanStructured\make_recursive($tree);
check(equal($lease(true, $tree), $tree)); $lease->close(); unset($lease); gc_collect_cycles();
$stats = recursive_probe_stats();
foreach (['nativeLive', 'zendLive', 'identities', 'borrowedContexts', 'callDepth'] as $key) check($stats[$key] === 0);
echo json_encode(['checks' => $checks, 'actualPhpBits' => PHP_INT_SIZE * 8,
    'contextChecks' => $contextChecks, 'staleGenerationChecks' => 6, 'tokenHighBitsPreserved' => true,
    'activeClose' => $activeClose, 'contextExhaustionRejections' => 3,
    'stats' => $stats], JSON_THROW_ON_ERROR);
