<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';

use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\copy_value;

$functions = [];
foreach (['echoArray' => [], 'echoList' => [], 'echoOption' => null, 'echoNested' => [[], [null]]] as $name => $payload) {
    $root = copy_value($payload, resultOf: $model['functions'][$name]); $alias = $root->share();
    $view = owned_call($name, [$root]); $child = owned_call($name, [$view]); $kept = $child->retain();
    $root->close(); check(!$view->closed(), 'shared empty root remains open');
    $alias->close(); check($view->closed() && $child->closed(), 'empty descendants expire without consuming exports');
    reject(fn() => $child->get(), 4); check($kept->get() === $payload, 'independent empty copy');
    dispose([$root, $alias, $view, $child, $kept]); unset($root, $alias, $view, $child, $kept);
    gc_collect_cycles(); $stats = owned_transfer_stats();
    check($stats['nativeLive'] === 0 && $stats['identities'] === 0, json_encode($stats));
}
Native::close(); $stats = owned_transfer_stats(); check($stats['live'] === 0);
$names = array_keys($functions); sort($names);
echo json_encode(['checks' => $checks, 'phpBits' => $stats['phpBits'], 'live' => $stats['live'], 'identities' => $stats['identities'], 'functions' => $names]);
