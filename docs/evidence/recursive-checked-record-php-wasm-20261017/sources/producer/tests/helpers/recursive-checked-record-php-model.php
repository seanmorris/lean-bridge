<?php
declare(strict_types=1);
// Exercise the standalone recursive PHP caller against an oracle with genuine generated classes
// and host checks. No Lean library, FFI call or installed package executes here.
if ($argc !== 5) throw new InvalidArgumentException('Expected caller, Brick Math and the recursive and mutual APIs');
require $argv[1];
require $argv[2];
require $argv[3];
require $argv[4];

use Brick\Math\BigInteger;

const RECURSIVE_PHP_FAULTS = ['produce-offset', 'produce-single', 'produce-digits', 'accept-int', 'accept-keyed',
    'wrong-host-exception', 'missing-fin', 'missing-normalization', 'conflated-constructor', 'diagnostic-suffix',
    'wrong-status', 'wrong-path', 'root-only', 'echo-unnormalized', 'echo-drops-tail', 'cycle-as-lean',
    'depth-unbounded', 'shared-as-cycle', 'groups-drop-none', 'echo-groups-drops-none', 'poison-after-reject'];
const RECURSIVE_PHP_MODULE_FAULTS = ['recursive' => ['second-normalizes-root-only'], 'mutual' => ['stop-as-none']];
// class_alias is process-wide, so this fault runs after every other selection of its module.
const RECURSIVE_PHP_LAST_FAULT = 'alias-constant';
const RECURSIVE_PHP_NORMALIZE = ['recursive' => 'normalizePacket', 'mutual' => 'normalizeEnvelope'];

function recursive_checked_record_php_model(string $module, ?string $fault = null): array {
    $spec = RECURSIVE_CHECKED_RECORD_MODULES[$module]; $ns = $spec['namespace'];
    $packet = "$ns\\{$spec['record']}"; $some = "$ns\\Some"; $error = "$ns\\LeanBridgeError";
    $stopClass = "$ns\\StepStop"; $moreClass = "$ns\\StepMore";
    $values = "$ns\\Internal\\Values"; $functions = ("$ns\\Internal\\GraphNativeTypes")::FUNCTIONS;
    [$valueName, $boundName, $linkName] = $spec['fields'];
    $mutual = $module === 'mutual';
    if ($fault === 'alias-constant') class_alias($packet, $packet . 'Alias');
    $n = fn(int|BigInteger $value): BigInteger => BigInteger::of($value);
    $build = fn($value, $digit, $link) => new $packet($value, $digit, $link);
    $poisoned = false;
    $reject = function (string $message) use (&$poisoned, $fault, $error): never {
        $poisoned = true;
        throw new $error($fault === 'diagnostic-suffix' ? "$message." : $message, $fault === 'wrong-status' ? 2 : 1);
    };
    // Shared acyclic subvalues are valid; this fault mistakes any revisit for a cycle.
    $revisits = function (mixed $value, array &$seen) use (&$revisits): bool {
        if (is_array($value)) { foreach ($value as $item) if ($revisits($item, $seen)) return true; return false; }
        if (!is_object($value) || $value instanceof BigInteger) return false;
        if (in_array($value, $seen, true)) return true;
        $seen[] = $value;
        foreach (get_object_vars($value) as $item) if ($revisits($item, $seen)) return true;
        return false;
    };
    // Host validation is the generated package's own; faults replace or bypass it explicitly.
    $host = function (int $function, array $args) use ($values, $functions, $fault, $error, $revisits): array {
        foreach ($args as $index => $value) {
            if ($fault === 'accept-int' && is_int($value)) { $args[$index] = BigInteger::of($value); continue; }
            if ($fault === 'accept-keyed' && is_array($value)) $args[$index] = $value = array_values($value);
            $seen = [];
            if ($fault === 'shared-as-cycle' && $revisits($value, $seen)) throw new ValueError('Cyclic copied value');
            try { $values::check($functions[$function]['parameters'][$index], $value); }
            catch (TypeError|ValueError $failure) {
                // Without the host bound, the native adapter's own limit refuses the copy instead.
                if ($fault === 'depth-unbounded' && $failure->getMessage() === 'Copied value exceeds 128 levels') throw new $error('Native copied call failed with status 2', 2);
                if ($fault === 'cycle-as-lean' && $failure->getMessage() === 'Cyclic copied value') throw new $error('Invalid copied value', 1);
                if ($fault === 'wrong-host-exception') throw new $error($failure->getMessage(), 1);
                throw $failure;
            }
        }
        return $args;
    };
    $child = function (object $record) use ($linkName, $mutual, $stopClass): array {
        $link = $record->$linkName;
        if ($link === null || ($mutual && $link->value instanceof $stopClass)) return [null, null];
        return $mutual ? [$link->value->packet, '.next?.more.packet'] : [$link->value, '.tail?'];
    };
    $rebuild = function (object $record, BigInteger $value, ?object $tail) use ($build, $boundName, $linkName, $mutual, $some, $stopClass, $moreClass, $fault): object {
        $link = $record->$linkName; $digit = $record->$boundName;
        if (!$mutual) return $build($value, $digit, $tail === null || $fault === 'echo-drops-tail' ? null : new $some($tail));
        if ($link === null || $link->value instanceof $stopClass)
            return $build($value, $digit, $link === null || $fault === 'stop-as-none' ? null : new $some(new $stopClass()));
        return $build($value, $digit, $fault === 'echo-drops-tail' ? null : new $some(new $moreClass($tail)));
    };
    $fin = function (object $record, string $path) use (&$fin, $child, $reject, $boundName, $fault): void {
        if ($record->$boundName->isGreaterThanOrEqualTo(3) && $fault !== 'missing-fin') $reject("$path.$boundName is not below its Fin 3 bound");
        [$nested, $link] = $child($record);
        if ($nested !== null && $fault !== 'root-only') $fin($nested, $path . ($fault === 'wrong-path' ? '' : $link));
    };
    $construct = function (object $record, string $path, string $site) use (&$construct, $child, $rebuild, $reject, $spec, $module, $valueName, $boundName, $fault): object {
        $make = $site === 'make' || $fault === 'conflated-constructor';
        [$plus, $limit, $word, $outer] = $make ? [1, 99, 'plusOne', $spec['make']] : [2, 89, 'plusTwo', RECURSIVE_PHP_NORMALIZE[$module]];
        $current = $record->$valueName;
        if ($current->isGreaterThan($limit)) $reject("$path.value was rejected by {$spec['lean']}.$word");
        [$nested, $link] = $child($record);
        $tail = $nested === null ? null : ($fault === 'root-only' ? $nested : $construct($nested, $path . ($fault === 'wrong-path' ? '' : $link), $site));
        $value = $current->plus($fault === 'missing-normalization' ? 0 : $plus);
        $digit = $record->$boundName;
        if (str_starts_with($outer, 'mk') && $digit->isGreaterThan($value)) $reject("$path was rejected by {$spec['lean']}.$outer");
        if ($outer === 'normalizePacket') $value = $fault === 'second-normalizes-root-only' && $path !== 'arg0' ? $current : $digit->plus(1);
        return $rebuild($record, $value, $tail);
    };
    $accepted = function (int $function, mixed $value, bool $groups, string $site) use (&$poisoned, $host, $fin, $construct, $some, $error, $fault): mixed {
        if ($poisoned && $fault === 'poison-after-reject') throw new $error('poisoned', 1);
        [$value] = $host($function, [$value]);
        if (!$groups) { $fin($value, 'arg0'); return $construct($value, 'arg0', $site); }
        foreach ($value as $index => $item) if ($item !== null) $fin($item->value, "arg0[$index]?");
        return array_map(fn($item, $index) => $item === null ? null : new $some($construct($item->value, "arg0[$index]?", $site)), $value, array_keys($value));
    };
    return [
        'first' => fn($value) => $accepted(0, $value, false, 'make')->$valueName,
        'second' => fn($value) => $accepted(1, $value, false, 'normalize')->$valueName,
        'echo' => function ($value) use ($accepted, $fault) {
            $result = $accepted(2, $value, false, 'make');
            return $fault === 'echo-unnormalized' ? $value : $result;
        },
        'groups' => function ($items) use ($accepted, $fault, $n) {
            $result = $accepted(3, $items, true, 'make');
            return $n(count($fault === 'groups-drop-none' ? array_filter($result) : $result));
        },
        'echo_groups' => function ($items) use ($accepted, $fault) {
            $result = $accepted(4, $items, true, 'normalize');
            return $fault === 'echo-groups-drops-none' ? array_values(array_filter($result)) : $result;
        },
        'produce' => function ($value) use ($host, $build, $some, $moreClass, $mutual, $fault, $n) {
            [$value] = $host(5, [$value]);
            $offset = $fault === 'produce-offset' ? 0 : 1;
            $digits = $fault === 'produce-digits' ? [2, 1] : [1, 2];
            if ($fault === 'produce-single') return $build($value->plus($offset), $n($digits[0]), null);
            $tail = $build($value->plus($offset + 1), $n($digits[1]), null);
            return $build($value->plus($offset), $n($digits[0]), new $some($mutual ? new $moreClass($tail) : $tail));
        },
    ];
}

$results = []; $rejected = [];
foreach (['recursive', 'mutual'] as $module) {
    $results[] = check_recursive_checked_records_php(recursive_checked_record_php_model($module), $module);
    $rejected[$module] = [];
    foreach ([...RECURSIVE_PHP_FAULTS, ...RECURSIVE_PHP_MODULE_FAULTS[$module], RECURSIVE_PHP_LAST_FAULT] as $fault) {
        try { check_recursive_checked_records_php(recursive_checked_record_php_model($module, $fault), $module, 2); }
        catch (RuntimeException $failure) {
            if (!str_starts_with($failure->getMessage(), 'failed: ')) throw new RuntimeException("Wrong failure for $module $fault: " . $failure->getMessage(), 0, $failure);
            $rejected[$module][] = $fault;
            continue;
        }
        throw new RuntimeException("Caller accepted $module fault: $fault");
    }
}
echo json_encode(['results' => $results, 'rejectedFaults' => $rejected, 'installedAcceptance' => false], JSON_THROW_ON_ERROR) . "\n";
