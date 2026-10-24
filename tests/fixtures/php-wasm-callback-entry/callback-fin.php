<?php
// Compact installed caller for the separately instrumented Fin callback probe.
declare(strict_types=0);

use Brick\Math\BigInteger;
use LeanReviewedcallbacks\LeanBridgeError;
use LeanReviewedcallbacks\Tile;
use function LeanReviewedcallbacks\counter;
use function LeanReviewedcallbacks\scaler;
use function LeanReviewedcallbacks\three;
use function LeanReviewedcallbacks\tile_maker;
use function LeanReviewedcallbacks\tiles;
use function LeanReviewedcallbacks\visit;
use function LeanReviewedcallbacks\with_recovery;

$leanBridgeCallbackProbeState = [];

function lean_bridge_callback_probe(string $control): array
{
    global $leanBridgeCallbackProbeState;
    $n = fn(int $value): BigInteger => BigInteger::of($value);
    $tile = fn(int $digit, int $count): Tile => new Tile($n($digit), $n($count));
    $refused = in_array($control, [
        'closure-input-refusal', 'invalid-recovery', 'actual-reply-rejection',
        'mixed-closure-input-refusal',
    ], true);
    $outcome = 'accepted';
    try {
        switch ($control) {
            case 'closure-input':
                $leanBridgeCallbackProbeState['scale'] = scaler($n(3));
                if (!$leanBridgeCallbackProbeState['scale']($n(4))->isEqualTo($n(12)))
                    throw new RuntimeException('closure Fin input');
                break;
            case 'closure-input-refusal':
                $leanBridgeCallbackProbeState['scale']($n(10));
                break;
            case 'closure-input-recovery':
                if (!$leanBridgeCallbackProbeState['scale']($n(2))->isEqualTo($n(6)))
                    throw new RuntimeException('closure Fin recovery');
                $leanBridgeCallbackProbeState['scale']->close();
                break;
            case 'closure-result':
                $closure = counter($n(8));
                if (!$closure($n(5))->isEqualTo($n(3)))
                    throw new RuntimeException('closure Fin result');
                $closure->close();
                break;
            case 'host-arguments':
                $seen = [];
                $host = function(BigInteger $digit) use (&$seen): BigInteger {
                    $seen[] = $digit->toInt(); return $digit->plus(1);
                };
                if (!visit(with_recovery($host, $n(0)))->isEqualTo($n(15))
                    || $seen !== [0, 1, 2, 3, 4])
                    throw new RuntimeException('host Fin arguments');
                break;
            case 'invalid-recovery':
                three(with_recovery(fn(BigInteger $value) => $value, $n(3)), $n(1));
                break;
            case 'actual-reply-rejection':
                three(with_recovery(fn(BigInteger $_value) => $n(3), $n(0)), $n(1));
                break;
            case 'later-call-recovery':
                if (!three(with_recovery(fn(BigInteger $value) => $value, $n(0)), $n(1))->isEqualTo($n(1)))
                    throw new RuntimeException('host Fin later recovery');
                break;
            case 'mixed-closure-input':
                $leanBridgeCallbackProbeState['tiles'] = tiles(null);
                if (!$leanBridgeCallbackProbeState['tiles']([$tile(2, 5), $tile(4, 1)])->isEqualTo($n(606)))
                    throw new RuntimeException('mixed closure Fin input');
                break;
            case 'mixed-closure-input-refusal':
                $leanBridgeCallbackProbeState['tiles']([$tile(5, 1)]);
                break;
            case 'mixed-closure-input-recovery':
                if (!$leanBridgeCallbackProbeState['tiles']([$tile(1, 7)])->isEqualTo($n(107)))
                    throw new RuntimeException('mixed closure Fin recovery');
                $leanBridgeCallbackProbeState['tiles']->close();
                break;
            case 'mixed-closure-result':
                $closure = tile_maker($n(4));
                if (!$closure($n(3))->equals($tile(2, 3)))
                    throw new RuntimeException('mixed closure Fin result');
                $closure->close();
                break;
            default:
                throw new InvalidArgumentException('unknown Fin callback probe control');
        }
    } catch (LeanBridgeError $error) {
        if (!$refused) throw $error;
        $outcome = 'refused';
    }
    if (($outcome === 'refused') !== $refused)
        throw new RuntimeException('Fin callback probe outcome differs');
    return ['control' => $control, 'outcome' => $outcome];
}
