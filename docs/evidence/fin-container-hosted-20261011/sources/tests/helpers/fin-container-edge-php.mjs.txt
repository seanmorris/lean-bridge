/**
 * Measure the full PHP edge consumer without replacing its generated API or assertions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { finContainerEdgeColumns, finContainerEdgeEntries } from "./fin-container-edge-dispatch.mjs";
import { finContainerEdgeConsumer, insertFinContainerEdgeFragment } from "./fin-container-edges.mjs";

/** Independently enumerate both original calls and every additive PHP edge case. */
export const finContainerEdgePhpExpected = Object.freeze((() => {
	const rows = [], counts = Array(8).fill(0);
	const add = (method, status) => {
		const index = finContainerEdgeEntries.indexOf(method);
		if(status === "ok")
		{
			counts[index + 2]++;
			if(index >= 4) counts[index - 4]++;
		}
		rows.push(Object.freeze([rows.length + 1, method, status, Object.freeze([...counts])]));
	};
	for(const status of ["ok", "fin", "ok"]) add("present", status);
	for(const status of ["ok", "ok", "fin"]) add("flatten", status);
	for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, "ok");
	for(let value = 0; value < 3; value++)
		for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, "fin");
	for(let value = 0; value < 3; value++) add("optionalDigits", "ok");
	for(let row = 0; row < 3; row++)
	{
		add("present", "fin"); add("optionalDigits", "fin");
		for(let column = 0; column < 3; column++) add("flatten", "fin");
	}
	add("present", "ok"); add("flatten", "ok");
	for(const method of ["emptyOption", "emptyList", "optionalDigits"]) add(method, "type");
	for(const method of finContainerEdgeEntries.slice(0, 3)) add(method, "value");
	for(let value = 0; value < 3; value++) add("optionalDigits", "value");
	for(let cycle = 0; cycle < 1000; cycle++)
		for(const method of ["emptyArray", "emptyList", "emptyOption", "present", "flatten", "optionalDigits"])
		{ add(method, "fin"); add(method, "ok"); }
	return rows;
})());

/**
 * Authenticate every call, status and counter, including the original assertion total.
 *
 * @param stdout - Actual PHP process output.
 */
export const readFinContainerEdgePhp = stdout => {
	assert.ok(typeof stdout === "string" && stdout.endsWith("\n"));
	const lines = stdout.slice(0, -1).split("\n");
	assert.equal(lines.pop(), "fin-container-ok:14089");
	assert.equal(lines.length, finContainerEdgePhpExpected.length);
	return lines.map((line, index) => {
		assert.match(line, /^edge-php [1-9][0-9]* [A-Za-z]+ (?:ok|fin|type|value)(?: (?:0|[1-9][0-9]{0,14})){8}$/u);
		const [, step, method, status, ...counts] = line.split(" ");
		const row = [Number(step), method, status, counts.map(Number)];
		assert.deepEqual(row, finContainerEdgePhpExpected[index], `PHP edge call ${index + 1}`);
		return row;
	});
};

const quote = value => "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
const snake = name => name.replace(/[A-Z]/gu, letter => `_${letter.toLowerCase()}`);

/**
 * Forward the six measured functions locally, preserving values and original exceptions.
 *
 * @param model - Verified native model.
 * @param component - Original component identity.
 * @param identity - Absolute verified Composer bootstrap and optional receipt-pinned package root.
 * @param identity.autoload - Exact Composer autoloader selected by the guarded installation.
 * @param identity.installed - Optional module-location checks for installed observation.
 * @param mode - Original weak or strict caller mode.
 */
export const finContainerEdgePhpProbe = async (model, component, { autoload, installed = null }, mode = "weak") => {
	finContainerEdgeColumns(model, component);
	assert.ok(["weak", "strict"].includes(mode));
	for(const path of [autoload, ...(installed === null ? [] : [installed])])
		assert.ok(typeof path === "string" && isAbsolute(path) && !path.includes("\0"));
	const prelude = String.raw`final class EdgeCounter {
    private static int $step = 0;
    public static function refuse(int $code, string $message): never {
        fwrite(STDERR, $message . "\n"); exit($code);
    }
    private static function record(): ?array {
        global $argv;
        $bytes = @file_get_contents($argv[1] ?? '');
        return is_string($bytes) && strlen($bytes) === 328
            ? array_values(unpack('a8magic/Vversion/Vwidth/a64config/a32nonce/Ppid/Vattached/Varmed/Vfailed/Vreserved/P8definitions/V8definers/V8flags/P8counts', $bytes)) : null;
    }
    private static function ours(?array $value): bool {
        global $argv;
        return count($argv) === 5 && $value !== null && $value[0] === 'LBFEDGDB'
            && $value[1] === 1 && $value[2] === 8 && $value[3] === $argv[3]
            && $value[4] === $argv[2] && $value[5] === getmypid() && $value[6] === 1;
    }
    public static function initial(): void {
        $value = self::record();
        if (!self::ours($value) || array_slice($value, 7, 11) !== array_fill(0, 11, 0)
            || array_slice($value, 18, 8) !== array_fill(0, 8, 4294967295)
            || array_slice($value, 26, 16) !== array_fill(0, 16, 0))
            self::refuse(2, 'edge record is not attached with empty counters');
    }
    public static function counts(): array {
        global $argv;
        $value = self::record();
        if (!self::ours($value) || $value[7] !== 255 || $value[8] !== 0 || $value[9] !== 0
            || array_slice($value, 10, 8) !== array_fill(0, 8, 1)
            || implode(',', array_slice($value, 18, 8)) !== $argv[4]
            || array_slice($value, 26, 8) !== array_fill(0, 8, 0))
            self::refuse(3, 'PHP edge definitions are not completely armed');
        return array_slice($value, 34, 8);
    }
    private static function recordCall(int $index, string $name, string $status, array $before): void {
        $after = self::counts();
        for ($column = 0; $column < 8; ++$column) {
            $delta = $status === 'ok' && ($column === $index + 2 || ($index >= 4 && $column === $index - 4)) ? 1 : 0;
            if ($after[$column] !== $before[$column] + $delta) self::refuse(5, 'wrong PHP edge dispatch count');
        }
        ++self::$step;
        echo implode(' ', ['edge-php', self::$step, $name, $status, ...$after]) . "\n";
    }
    public static function call(int $index, string $name, callable $call): mixed {
        $before = self::counts();
        if (self::$step === 0 && $before !== array_fill(0, 8, 0)) self::refuse(5, 'nonempty PHP edge counters before first call');
        try { $value = $call(); }
        catch (\Throwable $error) {
            if (get_class($error) === \TypeError::class) $status = 'type';
            elseif (get_class($error) === \ValueError::class && $error->getMessage() === 'Expected an unsigned integer') $status = 'value';
            elseif (get_class($error) === \LeanFincontainers\LeanBridgeError::class && $error->getCode() === 1
                && preg_match('/\Aarg[0-9]+(?:\[[0-9]+\]|\?)* is not below its Fin [0-9]+ bound\z/', $error->getMessage())) $status = 'fin';
            else throw $error;
            self::recordCall($index, $name, $status, $before);
            throw $error;
        }
        self::recordCall($index, $name, 'ok', $before);
        return $value;
    }
}
EdgeCounter::initial();
`;
	const wrappers = finContainerEdgeEntries.map((name, index) => `function ${index < 4 ? "edge_" : ""}${snake(name)}(mixed ...$args): mixed {
    return EdgeCounter::call(${index}, '${name}', fn() => \\LeanFincontainers\\${snake(name)}(...$args));
}`).join("\n");
	const location = installed === null ? "" : `
foreach (['src/Api.php', 'src/Internal/Native.php', 'src/Internal/Runtime.php'] as $relative) {
    $expected = ${quote(installed)} . '/' . $relative;
    $actual = array_values(array_filter(get_included_files(), fn($path) => str_ends_with($path, '/' . $relative)));
    if ($actual !== [$expected] || realpath($expected) !== $expected) EdgeCounter::refuse(6, 'unexpected PHP module location');
}
${finContainerEdgeEntries.map(name => `if ((new ReflectionFunction('LeanFincontainers\\\\${snake(name)}'))->getFileName() !== ${quote(installed + "/src/Api.php")}) EdgeCounter::refuse(6, 'unexpected PHP public function location');`).join("\n")}
`;
	let source = await finContainerEdgeConsumer("php-native");
	const imported = "use function LeanFincontainers\\{mirror_all, count_none, sum_huge, or_default, present, flatten, label, wrap_all};";
	assert.equal(source.split(imported).length, 2);
	source = source.replace(imported, imported.replace(", present, flatten", ""));
	for(const name of finContainerEdgeEntries.slice(0, 4))
	{
		const original = `\\LeanFincontainers\\${snake(name)}(`;
		assert.ok(source.includes(original));
		source = source.replaceAll(original, `\\edge_${snake(name)}(`);
	}
	source = insertFinContainerEdgeFragment(source, "require 'vendor/autoload.php';", prelude);
	source = source.replace("require 'vendor/autoload.php';", `require ${quote(autoload)};\n${location}\n${wrappers}`);
	assert.equal(source.split("declare(strict_types=0);").length, 2);
	return mode === "strict" ? source.replace("declare(strict_types=0);", "declare(strict_types=1);") : source;
};
