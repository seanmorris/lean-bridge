<?php
declare(strict_types=0);
use Brick\Math\BigInteger;

final class LoadingProbe {
    private static int $checks = 0;
    private static mixed $cedar;
    private static mixed $maple;
    private static mixed $saved;
    private static function check(bool $value): void {
        ++self::$checks;
        if (!$value) throw new RuntimeException('Shared PHP-Wasm assertion ' . self::$checks);
    }
    public static function exercise(string $order): array {
        self::$cedar = new LeanCedar\Parcel(new LeanCedar\VNext(new LeanCedar\VDone(BigInteger::of(7))));
        self::$maple = new LeanMaple\Parcel(new LeanMaple\VNext(new LeanMaple\VDone(BigInteger::of(9))));
        $calls = [
            static function () { self::check(LeanCedar\echo_(self::$cedar)->equals(self::$cedar)); self::check((string) LeanCedar\value() === '41'); },
            static function () { self::check(LeanMaple\echo_(self::$maple)->equals(self::$maple)); self::check((string) LeanMaple\value() === '43'); },
            static function () { self::check((string) LeanStone\value() === '47'); },
        ];
        foreach ($order === 'graph-first' ? $calls : array_reverse($calls) as $call) $call();
        for ($i = 0; $i < 128; ++$i) foreach ($calls as $call) $call();
        self::$saved = LeanCedar\echo_(self::$cedar);
        self::check(self::$saved !== self::$cedar);
        self::check(self::$saved->node !== self::$cedar->node);
        self::check(self::$saved->equals(self::$cedar));
        try { LeanCedar\echo_(self::$maple); throw new RuntimeException('Accepted a foreign nominal value'); }
        catch (TypeError $error) { self::check(true); }
        self::check(dl('probe.so'));
        $snapshot = lean_bridge_test_snapshot();
        self::check($snapshot === [1, 2, 1, 3, 3, 0]);
        return ['checks' => self::$checks, 'snapshot' => $snapshot, 'actualPhpBits' => PHP_INT_SIZE * 8,
            'hostVersion' => PHP_VERSION, 'copiedResults' => true, 'nominalRejection' => true];
    }
    public static function retire(): array {
        lean_bridge_test_retire();
        for ($i = 0; $i < 2; ++$i) {
            foreach ([fn() => LeanCedar\echo_(self::$cedar), fn() => LeanMaple\echo_(self::$maple), fn() => LeanStone\value()] as $call) {
                try { $call(); throw new RuntimeException('Call succeeded after shared retirement'); }
                catch (RuntimeException $error) { self::check($error->getCode() === 5); }
            }
        }
        self::check(self::$saved->equals(self::$cedar));
        $snapshot = lean_bridge_test_snapshot();
        self::check($snapshot === [1, 3, 1, 3, 3, 0]);
        return ['checks' => self::$checks, 'snapshot' => $snapshot, 'retirementRejections' => 6, 'copiedValueSurvived' => true];
    }
}
$request = json_decode(file_get_contents('/request.json'), true, 512, JSON_THROW_ON_ERROR);
echo json_encode(LoadingProbe::exercise($request['order']), JSON_THROW_ON_ERROR);
