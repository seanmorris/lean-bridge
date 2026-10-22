<?php
// Compact installed caller for the separately instrumented checked-record callback probe.
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanCallbackcheckedrecords\Interval;
use LeanCallbackcheckedrecords\LeanBridgeError;
use LeanCallbackcheckedrecords\Weighted;
use function LeanCallbackcheckedrecords\call_host;
use function LeanCallbackcheckedrecords\call_host_mixed;
use function LeanCallbackcheckedrecords\call_host_nested;
use function LeanCallbackcheckedrecords\make_closure;
use function LeanCallbackcheckedrecords\make_mixed_closure;
use function LeanCallbackcheckedrecords\make_nested_closure;
use function LeanCallbackcheckedrecords\with_recovery;

$leanBridgeCallbackProbeState = [];

function lean_bridge_callback_probe(string $control): array
{
    global $leanBridgeCallbackProbeState;
    $n = fn(int $value): BigInteger => BigInteger::of($value);
    $interval = fn(int $lo, int $hi): Interval => new Interval($n($lo), $n($hi));
    $weighted = fn(int $weight, int $limit): Weighted => new Weighted($n($weight), $n($limit));
    $refused = in_array($control, [
        'invalid-recovery', 'actual-reply-rejection', 'closure-input-refusal',
    ], true);
    $outcome = 'accepted';
    try {
        switch ($control) {
            case 'host-reply':
            case 'later-call-recovery':
                if (!call_host(with_recovery(
                    fn(Interval $_value) => $interval(1, 4), $interval(1, 3)
                ))->isEqualTo($n(3))) throw new RuntimeException('interval host reply');
                break;
            case 'invalid-recovery':
                call_host(with_recovery(fn(Interval $value) => $value, $interval(3, 1)));
                break;
            case 'actual-reply-rejection':
                call_host(with_recovery(
                    fn(Interval $_value) => $interval(5, 2), $interval(1, 3)
                ));
                break;
            case 'mixed-host':
                if (!call_host_mixed(with_recovery(
                    fn(BigInteger $marker, Interval $value) => $interval(
                        $value->lo->toInt(), $value->hi->plus($marker)->minus(5)->toInt()
                    ), $interval(1, 3)
                ))->isEqualTo($n(4))) throw new RuntimeException('mixed host reply');
                break;
            case 'nested-subtype':
                if (!call_host_nested(with_recovery(
                    fn(Weighted $_value) => $weighted(2, 5), $weighted(1, 2)
                ))->isEqualTo($n(3))) throw new RuntimeException('nested host reply');
                break;
            case 'closure-input':
                $leanBridgeCallbackProbeState['closure'] = make_closure($n(0));
                if (!$leanBridgeCallbackProbeState['closure']($interval(2, 5))->isEqualTo($n(3)))
                    throw new RuntimeException('interval closure input');
                break;
            case 'closure-input-refusal':
                $leanBridgeCallbackProbeState['closure']($interval(5, 2));
                break;
            case 'closure-input-recovery':
                if (!$leanBridgeCallbackProbeState['closure']($interval(3, 3))->isZero())
                    throw new RuntimeException('interval closure recovery');
                $leanBridgeCallbackProbeState['closure']->close();
                break;
            case 'mixed-closure':
                $closure = make_mixed_closure($n(0));
                if (!$closure($n(9), $interval(2, 5))->equals($interval(2, 5)))
                    throw new RuntimeException('mixed closure');
                $closure->close();
                break;
            case 'nested-closure':
                $closure = make_nested_closure($n(0));
                if (!$closure($weighted(2, 5))->isEqualTo($n(3)))
                    throw new RuntimeException('nested closure');
                $closure->close();
                break;
            default:
                throw new InvalidArgumentException('unknown checked-record callback probe control');
        }
    } catch (LeanBridgeError $error) {
        if (!$refused) throw $error;
        $outcome = 'refused';
    }
    if (($outcome === 'refused') !== $refused)
        throw new RuntimeException('checked-record callback probe outcome differs');
    return ['control' => $control, 'outcome' => $outcome];
}
