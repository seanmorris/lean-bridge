<?php
// Host feasibility probe: each call starts a compiled Lean worker in another Wasm heap.
function observe($pending): int {
    $packet = json_decode(vrzno_await($pending), true, flags: JSON_THROW_ON_ERROR);
    if ($packet['status'] !== 'ok') {
        throw new RuntimeException($packet['status']);
    }
    return $packet['value'];
}

$start = vrzno_shared('start');
$yielded = vrzno_shared('yielded');
$observed = [];
foreach (['success', 'cancel', 'worker-error', 'after'] as $mode) {
    $pending = $start($mode, 41);
    $yielded($mode);
    try {
        $observed[] = observe($pending);
    } catch (RuntimeException $error) {
        $observed[] = $error->getMessage();
    }
}
echo json_encode($observed, JSON_THROW_ON_ERROR);
