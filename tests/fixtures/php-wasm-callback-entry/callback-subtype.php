<?php
// Compact installed caller for the separately instrumented selected-Subtype callback probe.
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanCallbacksubtypes\LeanBridgeError;
use function LeanCallbacksubtypes\call_host;
use function LeanCallbacksubtypes\call_host_mixed;
use function LeanCallbacksubtypes\make_closure;
use function LeanCallbacksubtypes\make_mixed_closure;
use function LeanCallbacksubtypes\with_recovery;

$leanBridgeCallbackProbeState = [];

function lean_bridge_callback_probe(string $control): array
{
    global $leanBridgeCallbackProbeState;
    $n = fn(int $value): BigInteger => BigInteger::of($value);
    $refused = in_array($control, [
        'invalid-recovery', 'actual-reply-rejection', 'closure-input-refusal',
        'mixed-closure-refusal',
    ], true);
    $outcome = 'accepted';
    try {
        switch ($control) {
            case 'host-reply':
            case 'later-call-recovery':
                if (!call_host(with_recovery(
                    fn(BigInteger $_value) => $n(2), $n(1)
                ))->isEqualTo($n(2))) throw new RuntimeException('subtype host reply');
                break;
            case 'invalid-recovery':
                call_host(with_recovery(fn(BigInteger $value) => $value, $n(0)));
                break;
            case 'actual-reply-rejection':
                call_host(with_recovery(fn(BigInteger $_value) => $n(0), $n(1)));
                break;
            case 'mixed-host':
                if (!call_host_mixed(with_recovery(
                    fn(BigInteger $marker, BigInteger $value) => $marker->minus(5)->plus($value), $n(1)
                ))->isEqualTo($n(3))) throw new RuntimeException('subtype mixed host reply');
                break;
            case 'closure-input':
                $leanBridgeCallbackProbeState['closure'] = make_closure($n(0));
                if (!$leanBridgeCallbackProbeState['closure']($n(2))->isEqualTo($n(2)))
                    throw new RuntimeException('subtype closure input');
                break;
            case 'closure-input-refusal':
                $leanBridgeCallbackProbeState['closure']($n(0));
                break;
            case 'closure-input-recovery':
                if (!$leanBridgeCallbackProbeState['closure']($n(3))->isEqualTo($n(3)))
                    throw new RuntimeException('subtype closure recovery');
                $leanBridgeCallbackProbeState['closure']->close();
                break;
            case 'mixed-closure':
                $leanBridgeCallbackProbeState['mixed'] = make_mixed_closure($n(0));
                if (!$leanBridgeCallbackProbeState['mixed']($n(9), $n(2))->isEqualTo($n(2)))
                    throw new RuntimeException('subtype mixed closure');
                break;
            case 'mixed-closure-refusal':
                try {
                    $leanBridgeCallbackProbeState['mixed']($n(9), $n(0));
                } finally {
                    $leanBridgeCallbackProbeState['mixed']->close();
                }
                break;
            default:
                throw new InvalidArgumentException('unknown Subtype callback probe control');
        }
    } catch (LeanBridgeError $error) {
        if (!$refused) throw $error;
        $outcome = 'refused';
    }
    if (($outcome === 'refused') !== $refused)
        throw new RuntimeException('Subtype callback probe outcome differs');
    return ['control' => $control, 'outcome' => $outcome];
}
