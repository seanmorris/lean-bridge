<?php
declare(strict_types=1);
use LeanJobs\LeanBridgeError;
use function LeanJobs\hold;
$task=hold();
vrzno_shared('testCrash')();
try { $task->await(); throw new LogicException('Lost worker delivered a value'); }
catch (LeanBridgeError $e) { echo 'pending refused;'; }
try { hold(); throw new LogicException('Retired runtime accepted new work'); }
catch (LeanBridgeError $e) { echo 'new work refused'; }
