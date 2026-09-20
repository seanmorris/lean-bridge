<?php
declare(strict_types=1);
namespace LeanCompounds\Probe;
use LeanCompounds\{Some, Ok, Err, Bytes, Packet, LeanBridgeError};
use Brick\Math\BigInteger;
require 'vendor/autoload.php';

// Only this separate probe evaluates instrumented helpers, in memory. The
// Composer-installed API, native libraries and receipt remain byte-identical.
final class Faults {
    public static bool $active = false;
    public static int $count = 0, $target = 0, $clears = 0, $closed = 0;
    public static array $owners = [], $scopes = [];
    public static \Throwable $exception;
    public static function arm(int $target): void {
        self::$active = true; self::$target = $target;
        self::$count = self::$clears = self::$closed = 0;
        self::$owners = self::$scopes = [];
        self::$exception = new \RuntimeException('injected PHP conversion failure');
    }
    public static function tick(): void {
        if (self::$active && ++self::$count === self::$target) throw self::$exception;
    }
    public static function owner(\FFI\CData $value): void {
        if (self::$active) self::$owners[] = \WeakReference::create($value);
        self::tick();
    }
    public static function scope(object $scope): void {
        if (self::$active) self::$scopes[] = \WeakReference::create($scope);
    }
    public static function close(object $scope): void {
        if (self::$active) { ensure($scope->owners === []); ++self::$closed; }
    }
    public static function clear(): void { if (self::$active) ++self::$clears; }
}
$checks = 0; $failures = 0;
function ensure(bool $value): void {
    global $checks; ++$checks;
    if (!$value) throw new \RuntimeException('Fault-probe assertion ' . $checks);
}
function released(): void {
    Faults::$active = false; gc_collect_cycles();
    ensure(Faults::$clears === 1 && Faults::$closed === 1);
    ensure(count(Faults::$scopes) === 1);
    foreach ([...Faults::$owners, ...Faults::$scopes] as $owner) ensure($owner->get() === null);
    ensure(\LeanCompounds\classify(new Some(new Some(null))) === 2);
}
$root = realpath('vendor/lean-bridge-compounds/api/src/Internal');
$native = file_get_contents($root . '/Native.php');
ensure(str_starts_with($native, '<?php'));
$native = substr($native, 5);
$native = str_replace('namespace LeanCompounds\\Internal;', 'namespace LeanCompounds\\Probe;', $native, $count); ensure($count === 1);
$native = str_replace('__DIR__', var_export($root, true), $native, $count); ensure($count === 2);
$native = str_replace('$this->remaining -= $count * $width;', '$this->remaining -= $count * $width; Faults::tick();', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners[] = $memory;', '$this->owners[] = $memory; Faults::owner($memory);', $native, $count); ensure($count === 1);
$native = str_replace('$this->budget = new Budget();', '$this->budget = new Budget(); Faults::scope($this);', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners = [];', '$this->owners = []; Faults::close($this);', $native, $count); ensure($count === 1);
$native = preg_replace('~(\$ffi->[a-zA-Z0-9_]+_clear\(\\\\FFI::addr\(\$out\)\);)~', '$1 Faults::clear();', $native, -1, $count); ensure($count === 63);
eval($native); unset($native);
$request = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
$big = BigInteger::of(str_repeat('9', 500));
$packet = new Packet(new Some(new Ok([$big, null])), [[42, "text\0λ"], [true, '🌿']],
    [null, new Some(new Ok(['row', BigInteger::of('18446744073709551615')])), new Some(new Err([Bytes::fromString("\0\xff"), $big->negated()]))],
    new Ok(new Some(new Err('nested'))));
$deep = new Err("deep\0λ"); for ($i = 0; $i < 24; ++$i) $deep = new Some($deep);
$cases = [
    ['transform', $packet], ['duplicate', new Some(Bytes::fromString("\0\xff"))],
    ['option_nat', new Some($big)], ['option_string', null],
    ['result_string', new Ok("x\0λ")], ['result_string', new Err("x\0λ")],
    ['tuple_string', ['first', 'second']], ['deep', $deep]
];
$checkpoints = [];
foreach ($cases as [$name, $input]) {
    $method = $request[$name]['call'];
    Faults::arm(0); $output = Native::$method($input); unset($output);
    $limit = Faults::$count; released(); ensure($limit > 0); $checkpoints[] = ['name' => $name, 'count' => $limit];
    for ($target = 1; $target <= $limit; ++$target) {
        Faults::arm($target); $caught = false;
        try { Native::$method($input); }
        catch (\Throwable $error) { ensure($error === Faults::$exception); $caught = true; }
        unset($error); ensure($caught); released(); ++$failures;
    }
}
// Real validation and native combined-copy-budget errors also clear once.
foreach ([['option_nat', new Some(BigInteger::of(-1)), \ValueError::class],
    ['tuple_string', ['valid', 1], \TypeError::class],
    ['duplicate', new Some(Bytes::fromString(str_repeat('x', 6 * 1024 * 1024))), LeanBridgeError::class]] as [$name, $input, $kind]) {
    Faults::arm(0); $method = $request[$name]['call']; $caught = false;
    try { Native::$method($input); }
    catch (\Throwable $error) { ensure($error instanceof $kind); $caught = true; }
    unset($error); ensure($caught); released();
}

// Synthetic native outputs exercise tag/buffer validation, without asking a
// public consumer to know private C layouts or exposing malformed owned memory.
Faults::$active = false;
$ffi = (new \ReflectionMethod(Native::class, 'load'))->invoke(null);
$scope = new Scope($ffi);
function decode(array $request, string $name, mixed $value, Scope $scope): mixed {
    return (new \ReflectionMethod(Native::class, $request[$name]['from']))->invoke(null, $value, $scope);
}
function bad(callable $call, string $kind = \RuntimeException::class): void {
    try { $call(); } catch (\Throwable $error) { ensure($error instanceof $kind); return; }
    throw new \RuntimeException('Missing native-output rejection');
}
foreach (['option_string' => 'has_value', 'result_string' => 'is_ok'] as $name => $flag) {
    $value = $ffi->new($request[$name]['ctype']);
    foreach ([2, 255] as $tag) { $value->$flag = $tag; bad(fn() => decode($request, $name, $value, $scope)); }
}
$option = $ffi->new($request['option_string']['ctype']);
$option->value->length = 16777217;
ensure(decode($request, 'option_string', $option, $scope) === null); // Inactive payload is ignored.
$option->has_value = 1;
bad(fn() => decode($request, 'option_string', $option, $scope), \ValueError::class);
$option->value->length = 1;
bad(fn() => decode($request, 'option_string', $option, $scope)); // Missing buffer.
$option->value->data = $scope->buffer("\xff");
bad(fn() => decode($request, 'option_string', $option, $scope)); // Invalid UTF-8.
$option->value->data = null; $option->value->length = 0;
$decoded = decode($request, 'option_string', $option, $scope); ensure($decoded instanceof Some && $decoded->value === '');
$result = $ffi->new($request['result_string']['ctype']);
$result->is_ok = 1; $result->error->length = 16777217;
$decoded = decode($request, 'result_string', $result, $scope); ensure($decoded instanceof Ok && $decoded->value === '');
$result->is_ok = 0; $result->error->length = 0; $result->ok->length = 16777217;
$decoded = decode($request, 'result_string', $result, $scope); ensure($decoded instanceof Err && $decoded->value === '');
$scope->close(); ensure($scope->owners === []);
echo json_encode(['checks' => $checks, 'failures' => $failures, 'checkpoints' => $checkpoints,
    'realFailureCases' => 3, 'malformedOutputCases' => 7, 'inactivePayloadCases' => 3], JSON_THROW_ON_ERROR) . "\n";
