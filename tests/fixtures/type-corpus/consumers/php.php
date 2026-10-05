<?php
declare(strict_types=0);
namespace Corpus;

// Generated packages are the only API implementation used by this caller.
const MODE = "weak";
const PROFILE = "php-native";
const PARAMETER_PREFIX = "arg";
function exactTypes(): array {
    return PHP_INT_SIZE === 4 ? ['nat', 'int', 'uint64', 'uint32', 'int64'] : ['nat', 'int', 'uint64'];
}
function u32(int $value, string $module): mixed {
    $class = \Brick\Math\BigInteger::class;
    return PHP_INT_SIZE === 4 ? $class::of((string) $value) : $value;
}
function check(bool $condition, string $message = 'Corpus assertion failed'): void {
    if (!$condition) throw new \RuntimeException($message);
}
function rejected(string $expected, callable $call): \Throwable {
    try { $call(); } catch (\Throwable $error) {
        if ($error::class !== $expected) throw new \RuntimeException('Wrong exception: ' . $error, 0, $error);
        return $error;
    }
    throw new \RuntimeException('Invalid public input was accepted');
}
function bitsFromDecimal(string $digits, int $width): string {
    $bytes = '';
    for ($i = 0; $i < $width; ++$i) {
        $next = ''; $carry = 0;
        foreach (str_split($digits) as $digit) {
            $value = $carry * 10 + (int) $digit;
            $next .= (string) intdiv($value, 256); $carry = $value % 256;
        }
        $bytes .= chr($carry); $digits = ltrim($next, '0');
    }
    check($digits === '');
    return $bytes;
}
function bitsToDecimal(string $bytes): string {
    $digits = [0];
    foreach (array_reverse(array_values(unpack('C*', $bytes))) as $byte) {
        $carry = $byte;
        foreach ($digits as &$digit) { $value = $digit * 256 + $carry; $digit = $value % 10; $carry = intdiv($value, 10); }
        unset($digit);
        while ($carry) { $digits[] = $carry % 10; $carry = intdiv($carry, 10); }
    }
    return implode('', array_reverse($digits));
}
function decode(array $value, mixed $type, string $module): mixed {
    if (isset($value['integer'])) {
        if (in_array($type, exactTypes(), true)) {
            $class = \Brick\Math\BigInteger::class; return $class::of($value['integer']);
        }
        $integer = (int) $value['integer'];
        // On wasm32, out-of-range Int32 literals become PHP floats. Present that
        // host value to the public API; do not truncate it into a valid integer.
        if (PHP_INT_SIZE === 4 && (string) $integer !== $value['integer']) return (float) $value['integer'];
        check((string) $integer === $value['integer'], 'Caller integer is outside the PHP range');
        return $integer;
    }
    if (isset($value['string'])) return $value['string'];
    if (isset($value['bool'])) return $value['bool'];
    if (isset($value['unit'])) return null;
    if (isset($value['bytes'])) {
        $class = $module . '\Bytes'; return $class::fromString(pack('C*', ...$value['bytes']));
    }
    if (isset($value['array'])) return array_map(fn($item) => decode($item, $type['array'], $module), $value['array']);
    if (isset($value['record'])) {
        $class = $module . '\\' . $value['record']; $fields = [];
        foreach ($type['fields'] as $name => $fieldType) $fields[$name] = decode($value['fields'][$name], $fieldType, $module);
        return new $class(...$fields);
    }
    foreach (['float32' => ['g', 4], 'float64' => ['e', 8]] as $kind => [$format, $width]) {
        if (isset($value[$kind])) return $value[$kind] === 'nan' ? NAN : unpack($format, bitsFromDecimal($value[$kind], $width))[1];
    }
    throw new \RuntimeException('Unknown corpus input');
}
function encode(mixed $value, mixed $type, string $module): array {
    if (is_array($type)) {
        if (isset($type['array'])) {
            check(is_array($value) && array_is_list($value));
            return ['array' => array_map(fn($item) => encode($item, $type['array'], $module), $value)];
        }
        $name = substr($type['record'], strrpos($type['record'], '.') + 1);
        check($value::class === $module . '\\' . $name); $fields = [];
        foreach ($type['fields'] as $field => $fieldType) $fields[$field] = encode($value->$field, $fieldType, $module);
        return ['record' => $name, 'fields' => $fields];
    }
    if ($type === 'unit') { check($value === null); return ['unit' => true]; }
    if ($type === 'bool') { check(is_bool($value)); return ['bool' => $value]; }
    if ($type === 'string') { check(is_string($value)); return ['string' => $value]; }
    if ($type === 'bytes') {
        check($value::class === $module . '\Bytes');
        return ['bytes' => $value->count() ? array_values(unpack('C*', $value->toString())) : []];
    }
    if ($type === 'float32' || $type === 'float64') {
        check(is_float($value));
        return [$type => is_nan($value) ? 'nan' : bitsToDecimal(pack($type === 'float32' ? 'g' : 'e', $value))];
    }
    check(in_array($type, exactTypes(), true) ? $value::class === \Brick\Math\BigInteger::class : is_int($value));
    return ['integer' => (string) $value];
}
function publicType(mixed $type, string $module, bool $doc = false): string {
    if (is_array($type)) return isset($type['array']) ? ($doc ? 'list<' . publicType($type['array'], $module, true) . '>' : 'array')
        : ($doc ? '' : $module . '\\') . substr($type['record'], strrpos($type['record'], '.') + 1);
    if (in_array($type, exactTypes(), true)) return ($doc ? '\\' : '') . \Brick\Math\BigInteger::class;
    $name = match ($type) {
        'unit' => 'null', 'bool' => 'bool', 'string' => 'string', 'bytes' => 'Bytes',
        'nat', 'int', 'uint64' => 'BigInteger', 'float32', 'float64' => 'float', default => 'int'
    };
    return !$doc && in_array($name, ['Bytes', 'BigInteger'], true) ? $module . '\\' . $name : $name;
}
function declarations(array $request): void {
    $module = $request['module']; $expected = [];
    foreach ($request['signatures'] as $signature) {
        $operation = substr($signature['name'], strrpos($signature['name'], '.') + 1);
        $name = $module . '\\' . $request['operations'][$operation]; $expected[] = strtolower($name);
        $fn = new \ReflectionFunction($name);
        check($fn->getName() === $name && !$fn->returnsReference() && !$fn->isVariadic());
        check((string) $fn->getReturnType() === publicType($signature['result'], $module));
        $parameters = $fn->getParameters(); check(count($parameters) === count($signature['parameters']));
        foreach ($parameters as $i => $parameter) {
            check((string) $parameter->getType() === 'mixed' && $parameter->getName() === PARAMETER_PREFIX . $i);
            check(!$parameter->isOptional() && !$parameter->isPassedByReference() && !$parameter->isVariadic());
            check(str_contains($fn->getDocComment(), '@param ' . publicType($signature['parameters'][$i], $module, true) . ' $' . PARAMETER_PREFIX . $i));
        }
        check(str_contains($fn->getDocComment(), '@return ' . publicType($signature['result'], $module, true) . "\n"));
        if (is_array($signature['result']) && isset($signature['result']['record'])) {
            $record = $signature['result']; $class = new \ReflectionClass(publicType($record, $module));
            check($class->isFinal() && $class->isReadOnly() && !$class->isAbstract());
            $fields = $class->getProperties(); check(array_map(fn($field) => $field->getName(), $fields) === array_keys($record['fields']));
            $constructor = $class->getConstructor(); check($constructor->isPublic());
            check(count($constructor->getParameters()) === count($fields));
            foreach ($fields as $i => $field) {
                $type = $record['fields'][$field->getName()]; $parameter = $constructor->getParameters()[$i];
                check($field->isPublic() && !$field->isStatic() && $field->isReadOnly());
                check((string) $field->getType() === publicType($type, $module));
                check(str_contains($field->getDocComment(), '@var ' . publicType($type, $module, true) . ' '));
                check($parameter->getName() === $field->getName() && (string) $parameter->getType() === 'mixed');
                check(!$parameter->isOptional() && !$parameter->isPassedByReference());
            }
        }
    }
    $actual = array_values(array_filter(get_defined_functions()['user'], fn($name) => str_starts_with(strtolower($name), strtolower($module) . '\\')));
    sort($actual); sort($expected); check($actual === $expected);
}
function independentRecord(object $input, object $output, array $type, string $module, callable $call): void {
    check($input !== $output); $matrix = null; $fields = [];
    foreach ($type['fields'] as $field => $fieldType) {
        $fields[$field] = $input->$field;
        if (is_array($fieldType)) $matrix = $field;
        if (in_array($fieldType, ['nat', 'int'], true)) check($input->$field !== $output->$field);
    }
    check(is_string($matrix));
    $before = encode($input, $type, $module); $observed = encode($output, $type, $module);
    $row = $input->$matrix[0]; $empty = $input->$matrix[1];
    $fields[$matrix] = [&$row, &$empty]; $class = $input::class; $copy = new $class(...$fields);
    $result = $call($copy); check(encode($result, $type, $module) === $observed);
    $row[0] = 17; $empty[] = 29; $fields[$matrix][0] = [31];
    check(encode($copy, $type, $module) === $before && encode($result, $type, $module) === $observed);
    $rows = $output->$matrix; $rows[0][0] = 47; $rows[1] = [53];
    check(encode($input, $type, $module) === $before && encode($output, $type, $module) === $observed);
    foreach ([$input, $output] as $record) {
        $error = rejected(\Error::class, function() use ($record, $matrix) { $record->$matrix[0][0] = 71; });
        check(str_contains($error->getMessage(), 'readonly property'));
    }
}
function observe(array $entry, array $signature, array $request, callable $recover): array {
    $module = $request['module']; $call = $module . '\\' . $request['operations'][$entry['operation']];
    $stage = 'public-constructor'; $args = [];
    try {
        foreach ($entry['arguments'] as $i => $argument) $args[] = decode($argument, $signature['parameters'][$i], $module);
        $stage = 'public-call'; $before = $entry['checkIndependentCopy'] ? encode($args[0], $signature['parameters'][0], $module) : null;
        $result = $call(...$args);
    } catch (\Throwable $error) {
        if ($entry['expectation']['kind'] !== 'host-rejection') throw $error;
        return [['id' => $entry['id'], 'status' => 'rejected-as-expected', 'exception' => $error::class,
            'message' => $error->getMessage(), 'recovered' => true, 'recovery' => $recover(), 'stage' => $stage], []];
    }
    check($entry['expectation']['kind'] === 'lean-oracle', 'Invalid catalog input was accepted');
    $observed = encode($result, $signature['result'], $module); $references = [];
    if ($entry['checkIndependentCopy']) {
        check(encode($args[0], $signature['parameters'][0], $module) === $before);
        independentRecord($args[0], $result, $signature['result'], $module, $call);
        $references = [\WeakReference::create($args[0]), \WeakReference::create($result)];
    }
    return [['id' => $entry['id'], 'status' => 'matched', 'observed' => $observed, 'independentCopy' => $entry['checkIndependentCopy']], $references];
}

$root = rtrim(__DIR__, '/') . '/';
$request = json_decode(file_get_contents($root . 'request.json'), true, 512, JSON_THROW_ON_ERROR);
check($request['profile'] === PROFILE);
require_once $root . $request['autoload'];
if (PROFILE === 'php-native') {
    check(!PHP_ZTS && PHP_SAPI === 'cli');
    check(PHP_INT_SIZE === 8 && PHP_OS_FAMILY === 'Linux');
    check(php_ini_loaded_file() === false && php_ini_scanned_files() === false);
    check(ini_get('ffi.enable') === '1' && ini_get('auto_prepend_file') === '' && ini_get('auto_append_file') === '');
} else {
    check(PROFILE === 'php-wasm' && PHP_INT_SIZE === 4 && str_starts_with(PHP_VERSION, '8.4.'));
    check(!PHP_ZTS && PHP_SAPI === 'embed');
    check(!extension_loaded('ffi'));
}
declarations($request);
$module = $request['module']; $operations = array_values($request['operations']);
$functions = array_map(fn($name) => $module . '\\' . $name, $operations);
$recover = fn() => encode($functions[0](u32(7, $module)), 'uint32', $module);
$results = []; $errors = []; $signatures = $request['signatures'];
foreach ($request['cases'] as $entry) {
    $signature = $signatures[array_search($entry['operation'], array_keys($request['operations']), true)];
    [$observed, $references] = observe($entry, $signature, $request, $recover); $results[] = $observed;
    gc_collect_cycles(); foreach ($references as $reference) check($reference->get() === null, 'Copied record remains retained');
}
$integer = \Brick\Math\BigInteger::class; $bytes = $module . '\Bytes';
$recordType = $signatures[6]['parameters'][0]; $recordCase = array_values(array_filter($request['cases'], fn($case) => $case['checkIndependentCopy']))[0];
$fields = $recordCase['arguments'][0]['fields']; $title = array_search('string', $recordType['fields'], true);
$matrix = array_keys(array_filter($recordType['fields'], fn($type) => is_array($type)))[0];
$badText = function() use ($recordCase, $title, $recordType, $module) {
    $wire = $recordCase['arguments'][0]; $wire['fields'][$title] = ['string' => "\xff"];
    return decode($wire, $recordType, $module);
};
$forgedRecord = function() use ($recordCase, $recordType, $module, $matrix, $functions) {
    $valid = decode($recordCase['arguments'][0], $recordType, $module);
    $forged = (new \ReflectionClass($valid::class))->newInstanceWithoutConstructor();
    foreach ($recordType['fields'] as $field => $type) (new \ReflectionProperty($valid::class, $field))->setValue($forged, $field === $matrix ? [[null]] : $valid->$field);
    return $functions[6]($forged);
};
$forgedNat = function() use ($integer, $functions, $module) {
    $forged = (new \ReflectionClass($integer))->newInstanceWithoutConstructor();
    (new \ReflectionProperty($integer, 'value'))->setValue($forged, 'invalid');
    return $functions[1]($forged, u32(0, $module));
};
$invalid = [
    'null-string' => fn() => $functions[3](null, ''), 'null-bytes' => fn() => $functions[11](null),
    'null-array' => fn() => $functions[4](null, u32(0, $module)), 'null-record' => fn() => $functions[6](null),
    'null-nat' => fn() => $functions[1](null, u32(0, $module)), 'null-bool' => fn() => $functions[9](null),
    'numeric-string' => fn() => $functions[0]('1'), 'float-as-int' => fn() => $functions[0](1.0),
    'wrong-nat-wrapper' => fn() => $functions[1](1, u32(0, $module)), 'wrong-u64-wrapper' => fn() => $functions[7](1),
    'raw-bytes' => fn() => $functions[11]('abc'), 'negative-u64' => fn() => $functions[7]($integer::of('-1')),
    'non-list' => fn() => $functions[4]([1 => u32(1, $module)], u32(0, $module)), 'nested-non-list' => fn() => $functions[5]([[1 => u32(1, $module)]]),
    'malformed-utf8' => fn() => $functions[3]("\xff", ''), 'record-utf8' => $badText,
    'forged-record' => $forgedRecord, 'forged-nat' => $forgedNat,
    'bytes-limit' => fn() => $functions[11]($bytes::fromString(str_repeat('x', 16 * 1024 * 1024 + 1))),
    'string-limit' => fn() => $functions[3](str_repeat('x', 16 * 1024 * 1024 + 1), ''),
    'array-limit' => fn() => $functions[4](array_fill(0, 600000, u32(0, $module)), u32(0, $module)),
    'output-limit' => fn() => $functions[3](str_repeat('x', 4 * 1024 * 1024), str_repeat('y', 4 * 1024 * 1024))
];
if (PROFILE === 'php-wasm') {
    $invalid['wrong-u32-wrapper'] = fn() => $functions[0](1);
    $invalid['wrong-i64-wrapper'] = fn() => $functions[8](1);
}
check(array_keys($invalid) === array_keys($request['runtimeCases']));
foreach ($request['runtimeCases'] as $id => $exception) {
    for ($iteration = 0; $iteration < 3; ++$iteration) {
        $error = rejected($exception === 'LeanBridgeError' ? $module . '\LeanBridgeError' : $exception, $invalid[$id]);
        if ($exception === 'LeanBridgeError') check($error->getCode() > 0 && str_contains($error->getMessage(), 'limit'));
        $errors[] = ['id' => $id, 'iteration' => $iteration, 'exception' => $exception, 'recovery' => $recover()];
    }
}
$api = (new \ReflectionFunction($functions[0]))->getFileName(); $native = [];
foreach (PROFILE === 'php-native' ? file('/proc/self/maps', FILE_IGNORE_NEW_LINES) : [] as $line) {
    $parts = preg_split('/\s+/', trim($line), 6); $path = $parts[5] ?? '';
    if (str_ends_with($path, '.so') && str_starts_with($path, __DIR__ . '/vendor/')) $native[$path] = hash_file('sha256', $path);
}
ksort($native); $included = [];
foreach (get_included_files() as $path) { check(str_starts_with($path, $root)); $included[substr($path, strlen($root))] = hash_file('sha256', $path); }
ksort($included);
echo json_encode(['schemaVersion' => 1, 'profile' => PROFILE, 'module' => $module, 'hostVersion' => PHP_VERSION,
    'callerMode' => MODE, 'integerBytes' => PHP_INT_SIZE, 'threadSafe' => PHP_ZTS, 'sapi' => PHP_SAPI,
    'iniDisabled' => PROFILE === 'php-native', 'copiedValuesCollected' => true, 'apiLocation' => $api,
    'nativeLibraries' => $native, 'includedFiles' => $included, 'results' => $results, 'errors' => $errors], JSON_THROW_ON_ERROR), "\n";
