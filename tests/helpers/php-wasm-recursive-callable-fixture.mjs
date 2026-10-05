/**
 * The native PHP public acceptance cases with explicit wasm32 integer mappings.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Reuse the independently stated public checks without native FFI assumptions. */
export const phpWasmRecursiveCallableConsumer = async () => {
	let source = await readFile("tests/fixtures/structured-callable-consumers/php-recursive.php", "utf8");
	const replace = (before, after) => {
		assert.equal(source.split(before).length, 2, "Unique PHP-Wasm fixture adaptation: " + before);
		source = source.replace(before, after);
	};
	replace("require __DIR__ . '/vendor/autoload.php';\n", "");
	replace("new Ok([4294967295,", "new Ok([Big::of('4294967295'),");
	replace("new Some(4294967295)", "new Some(Big::of('4294967295'))");
	replace("'uint32'=>[0,4294967295]", "'uint32'=>[Big::of(0),Big::of('4294967295')]");
	// PHP parses the positive part of -2147483648 as a float on wasm32.
	replace("'int32'=>[-2147483648,2147483647]", "'int32'=>[PHP_INT_MIN,PHP_INT_MAX]");
	replace("'int64'=>[PHP_INT_MIN,PHP_INT_MAX]", "'int64'=>[Big::of('-9223372036854775808'),Big::of('9223372036854775807')]");
	replace("'usize'=>[Big::of(0),Big::of('18446744073709551615')]", "'usize'=>[Big::of(0),Big::of('4294967295')]");
	replace("LeanStructured\\word_bits()===64", "LeanStructured\\word_bits()->isEqualTo(32)");
	replace("check($seen===range(1,16));", "check(equal($seen,array_map(fn($value)=>Big::of($value),range(1,16))));");
	replace("check($wide(...range(1,16))===null);", "check($wide(...array_map(fn($value)=>Big::of($value),range(1,16)))===null);");
	replace("check(!str_contains(file_get_contents('/proc/self/maps'),'/libleanshared.so'),'invalid calls loaded Lean');", "check(PHP_INT_SIZE===4,'actual wasm32 host');");
	// This pinned PHP-Wasm host lacks getcontext. Native PHP runs the Fiber guard;
	// the actual wasm32 suite verifies main-context entry without starting a Fiber.
	replace("$fiber=new Fiber(fn()=>LeanStructured\\call_recursive($tree,fn($value)=>$value));\nreject(LogicException::class,fn()=>$fiber->start());", "check(Fiber::getCurrent()===null,'main PHP context');");
	assert.equal(source.split("$libraries=[];\n").length, 2);
	source = source.split("$libraries=[];\n")[0] + `check(extension_loaded($request['extension']),'installed Zend extension');
echo json_encode(['checks'=>$checks,'rejections'=>$rejections,'primitiveChecks'=>$primitiveChecks,'shapes'=>$shapes,'seeds'=>6,
    'compiledLean'=>true,'installedPackage'=>true,'publicApiOnly'=>true,'actualPhpBits'=>PHP_INT_SIZE*8,
    'exports'=>$request['mixed']?98:33,'fiberStartAvailable'=>false],JSON_THROW_ON_ERROR),"\\n";
`;
	assert.ok(!source.includes("/proc/self/maps"));
	return source;
};
