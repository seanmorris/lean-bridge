// Appended to the common value definitions, without the wrapper-test loop.
function constructionProbe(int $shape, bool $owned, int $point): void {
    $before = recursive_probe_stats();
    foreach (['nativeLive', 'zendLive', 'identities', 'borrowedContexts', 'callDepth'] as $key)
        if ($before[$key] !== 0) throw new RuntimeException('construction_before_' . $key);
    $shapes = ['array', 'list', 'option', 'result', 'tuple', 'record', 'variant', 'alias', 'recursive'];
    $input = values(2)[$shape]; $lease = null;
    if ($owned) {
        $make = 'LeanStructured\\make_' . $shapes[$shape]; $lease = $make($input);
        $operation = fn() => $lease(true, $input);
    } else {
        $call = 'LeanStructured\\twice_' . $shapes[$shape];
        $operation = fn() => $call($input, fn($value) => $value);
    }
    recursive_probe_construction($point);
    if ($point) echo 'armed';
    try { check(equal($operation(), $input)); }
    finally { $lease?->close(); }
    unset($operation, $lease); gc_collect_cycles();
    if ($point) throw new RuntimeException('construction_abort_returned');
    $after = recursive_probe_stats();
    foreach (['nativeLive', 'zendLive', 'identities', 'borrowedContexts', 'callDepth'] as $key)
        if ($after[$key] !== 0) throw new RuntimeException('construction_after_' . $key);
    echo json_encode(['shape' => $shapes[$shape], 'owned' => $owned,
        'attempts' => $after['constructionAttempts'], 'before' => $before, 'after' => $after], JSON_THROW_ON_ERROR);
}
