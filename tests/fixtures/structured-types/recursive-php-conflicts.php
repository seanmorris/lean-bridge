<?php
declare(strict_types=1);
// Two definitions of one PHP namespace cannot be autoloaded together. Install
// both unchanged archives, autoload one API, then probe the shared native registry
// with the second archive's original evidence. No installed source is rewritten.
require __DIR__ . '/vendor/composer/ClassLoader.php';
$autoload = new Composer\Autoload\ClassLoader(); $autoload->addPsr4('Brick\\Math\\', __DIR__ . '/vendor/brick/math/src'); $autoload->register();
$request = json_decode(file_get_contents(__DIR__ . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
$mode = $argv[1]; $first = (int) $argv[2]; $second = $mode === 'duplicate' ? $first : 1 - $first;
$root = fn(int $index): string => __DIR__ . '/vendor/' . $request[$index]['name'];
require $root($first) . '/src/Api.php';
$checks = 0;
function check(bool $value): void { global $checks; ++$checks; if (!$value) throw new RuntimeException('PHP conflict assertion ' . $checks); }
function nativeMappings(): array {
    $mappings = [];
    foreach (explode("\n", file_get_contents('/proc/self/maps')) as $line)
        if (preg_match('~ (/[^\n]+/native/linux-x64/(lib[^/]+\.so))$~', $line, $match)) $mappings[$match[2]] = ['path' => $match[1], 'sha256' => hash_file('sha256', $match[1])];
    ksort($mappings); return $mappings;
}
check(LeanCollision\value() === $request[$first]['value']);
$before = nativeMappings();
$definitions = (new ReflectionClass(LeanCollision\Internal\Native::class))->getConstant('DEFINITIONS');
try {
    $ffi = LeanBridge\CopiedNativeV1\Runtime::load($root($second) . '/native/linux-x64', $request[$second]['evidence'], $definitions);
    check($mode === 'duplicate');
} catch (RuntimeException $error) {
    check($mode === 'conflict'); check(str_contains($error->getMessage(), 'Conflicting builds'));
}
check(nativeMappings() === $before);
check(LeanCollision\value() === $request[$first]['value']);
$input = new LeanCollision\Parcel(new LeanCollision\VNext(new LeanCollision\VDone(9)));
check(LeanCollision\echo_($input)->equals($input));
$mappings = array_map(fn(array $entry): string => $entry['sha256'], $before);
check(count($mappings) === 4); ksort($mappings);
echo json_encode(['checks' => $checks, 'mode' => $mode, 'first' => $first, 'mappingUnchanged' => true, 'originalUsable' => true, 'mappings' => $mappings], JSON_THROW_ON_ERROR) . "\n";
