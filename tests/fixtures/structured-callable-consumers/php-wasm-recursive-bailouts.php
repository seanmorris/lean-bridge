<?php
declare(strict_types=0);
require '/dependencies/brick-math/autoload.php';
require '/src/Api.php';

function abortRecursiveRequest(int $mode): never {
    $tree = new LeanStructured\TreeLeaf(Brick\Math\BigInteger::of(7));
    if ($mode === 0) {
        LeanStructured\call_array([new LeanStructured\Some('exit unwinds')], fn() => exit(0));
    } elseif ($mode === 1) {
        LeanStructured\call_recursive($tree, fn() => recursive_probe_bailout());
    } elseif ($mode === 2) {
        $GLOBALS['abortedOwner'] = LeanStructured\make_recursive($tree);
        LeanStructured\call_recursive($tree, fn($value) => LeanStructured\call_recursive($value,
            fn() => recursive_probe_bailout()));
    } elseif ($mode === 3) {
        $private = PRIVATE_ARRAY_CALL;
        $private([['reply teardown']], fn() => new class {
            public function __destruct() { recursive_probe_bailout(); }
        });
    } elseif ($mode === 4) {
        $private = PRIVATE_ARRAY_CALL;
        $private([['reply teardown']], fn() => new class {
            public function __destruct() { exit(0); }
        });
    } else { throw new ValueError('Unknown request abort probe'); }
    throw new RuntimeException('request_abort_returned');
}
