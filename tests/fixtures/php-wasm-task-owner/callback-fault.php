<?php
declare(strict_types=1);
use Brick\Math\BigInteger as B;
use LeanRelay as R;
$task=R\worker(B::of(7),function(B $v): B { vrzno_await(vrzno_shared('testCrash')()); return $v; });
try { $task->await(); throw new LogicException('Lost worker delivered a callback value'); }
catch (R\LeanBridgeError $e) { echo 'pending refused;'; }
try { R\add(B::of(1)); throw new LogicException('Retired runtime accepted new work'); }
catch (R\LeanBridgeError $e) { echo 'new work refused'; }
