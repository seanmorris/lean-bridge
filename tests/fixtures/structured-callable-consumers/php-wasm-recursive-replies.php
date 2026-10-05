// Appended to the common value definitions, without the wrapper-test loop.
recursive_probe_reply_ownership(true);
$shapes = ['array', 'list', 'option', 'result', 'tuple', 'record', 'variant', 'alias', 'recursive'];
foreach ($shapes as $index => $shape) {
    $input = values(0)[$index];
    $call = 'LeanStructured\\twice_' . $shape;
    // Fresh reply strings differ from the input. No earlier callback argument
    // can accidentally keep the first reply's Zend string storage alive.
    $output = $call($input, static fn() => values(2)[$index]);
    check(equal($output, values(2)[$index]));
}
recursive_probe_reply_ownership(false); gc_collect_cycles();
$stats = recursive_probe_stats();
check($stats['replyChecks'] === 18 && $stats['replyFailures'] === 0);
foreach (['nativeLive', 'zendLive', 'identities', 'borrowedContexts', 'callDepth'] as $key) check($stats[$key] === 0);
echo json_encode(['checks' => $checks, 'actualPhpBits' => PHP_INT_SIZE * 8,
    'checkedBeforeLeanCopy' => true, 'stats' => $stats], JSON_THROW_ON_ERROR);
