<?php
declare(strict_types=1);
use function LeanDepot\{make,pending};
use LeanDepot\LeanBridgeError;
$t=make(\Brick\Math\BigInteger::of(1)); $task=pending($t);
vrzno_shared('testCrash')();
try { $task->await(); throw new LogicException('Lost worker delivered a lease'); }
catch (LeanBridgeError $e) { echo 'pending refused;'; }
try { make(\Brick\Math\BigInteger::of(2)); throw new LogicException('Retired runtime accepted new work'); }
catch (LeanBridgeError $e) { echo 'new work refused'; }
if (!$t->isClosed()) throw new LogicException('Retired heap kept a live lease');
