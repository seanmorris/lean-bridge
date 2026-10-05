/**
 * Reuse public PHP assertions with explicit wasm32 integers and host observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Keep the callback, exception and lifetime checks identical across PHP hosts.
 *
 * @param sourcePath - Ordinary Lean source or independently reviewed Binding IR.
 */
export const phpWasmStructuredCallableConsumer = async sourcePath => {
	let source = await readFile("tests/fixtures/structured-callable-consumers/php.php", "utf8");
	for(const [previous, current] of [
		["4294967295", "$big('4294967295')"]
		, ["4294967296", "$big('4294967296')"]
		, ["new Ok([0, ''])", "new Ok([$big(0), ''])"]
		, ["new Ok(new Some(0))", "new Ok(new Some($big(0)))"]
		, ["const PARAMETER_PREFIX = 'arg';", `const PARAMETER_PREFIX = '${sourcePath === "reviewed-ir" ? "value" : "arg"}';`]
	]) {
		assert.ok(source.includes(previous), previous);
		source = source.replaceAll(previous, current);
	}
	const fiber = String.raw`$fiber = new Fiber(function () use ($closure, $record) {
    rejects(LogicException::class, fn() => $closure(true, $record));
    rejects(LogicException::class, fn() => LeanStructured\call_record($record, fn($value) => $value));
}); $fiber->start(); check($fiber->isTerminated()); $closure->close();`;
	assert.equal(source.split(fiber).length, 2);
	source = source.replace(fiber, `// The pinned host cannot start Fibers. A separate contract test checks the Lease guard.
check(Fiber::getCurrent() === null); $closure->close();`);
	const footer = source.indexOf("$libraries = [];");
	assert.ok(footer > 0); assert.equal(source.lastIndexOf("$libraries = [];"), footer);
	return source.slice(0, footer) + String.raw`
check(PHP_INT_SIZE === 4); check($calls === 2803); check($rejected === 623);
// Construct temporary replies with no retained PHP owner, including nested text.
for ($iteration = 0; $iteration < 64; ++$iteration) {
    $expected = str_repeat("λ\0", $iteration + 1) . $iteration;
    $reply = LeanStructured\call_array([], static fn($value) => [new Some(str_repeat("λ\0", $iteration + 1) . $iteration)]);
    same($reply, [new Some($expected)]);
    $seen = 0;
    $reply = LeanStructured\twice_array([], static function ($value) use ($iteration, &$seen) {
        if ($seen++) same($value, [new Some(str_repeat("λ\0", $iteration + 1) . $iteration)]);
        gc_collect_cycles(); return [new Some(str_repeat("λ\0", $iteration + 1) . $iteration)];
    });
    same($reply, [new Some($expected)]); check($seen === 2);
}
echo 'php-wasm-structured-callables-ok:', $checks, "\n";
`;
};
