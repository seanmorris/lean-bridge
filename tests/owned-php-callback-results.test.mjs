/**
 * Callback-local PHP generators, factories and opt-in real Lean execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateOwnedPhpCalls } from "../src/backends/php/owned-calls.mjs";
import { generateOwnedPhpPackage, auditOwnedPhpPackage } from "../src/backends/php/owned-package.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustTransferReviewedIr } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultCombinedReviewedIr } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import "./helpers/owned-php-callback-result-runtime-tests.mjs";

const enabled = process.env.LEAN_BRIDGE_OWNED_PHP_CALLBACK_RESULT_TEST === "1";
const combinedOptions = { transferredInputs: true, anchoredResults: true, receiverExports: true };
const optionsFor = variant => ({ callbackResultAnchors: true
	, hostCallbacks: variant !== "no-host"
	, ...variant === "combined" ? combinedOptions : {} });
const fixtureFor = variant => (variant === "combined" ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();

// These unnamed containers occur only in callback signatures. No exported
// declaration can supply a resultOf/parameterOf selector for them.
const factoryIr = () => {
	const ir = ownedDotnetCallbackResultReviewedIr();
	const template = ir.types.find(type => type.kind === "callback");
	const original = ir.declarations.find(fn => fn.name === "makeRecordCallback");
	const ticket = { kind: "named", id: "lean:Owned.Ticket" }, bool = { kind: "primitive", name: "bool" };
	const array = { kind: "apply", constructor: "array", arguments: [ticket] };
	const list = { kind: "apply", constructor: "list", arguments: [ticket] };
	const optional = { kind: "apply", constructor: "option", arguments: [ticket] };
	const tuple = { kind: "apply", constructor: "tuple", arguments: [array, list] };
	ir.types = [ir.types.find(type => type.id === ticket.id)]; ir.declarations = [];
	const add = (name, parameters, result, anchor) => {
		const type = structuredClone(template), id = "bridge:" + name;
		type.id = id; type.name = name; type.source.declaration = name;
		type.callable.parameters = parameters.map((ref, index) => ({ ...structuredClone(template.callable.parameters[0])
			, name: "arg" + index, type: ref
			, ownership: ref.kind === "primitive" ? "copy" : "borrow"
			, lifetime: ref.kind === "primitive" ? null : { scope: "call", anchor: null } }));
		type.callable.result = { type: result
			, ownership: anchor !== undefined ? "borrow" : result.kind === "primitive" ? "copy" : "lease"
			, lifetime: anchor !== undefined ? { scope: "parameter", anchor: "arg" + anchor }
				: result.kind === "primitive" ? null : { scope: "explicit", anchor: null } };
		ir.types.push(type);
		const fn = structuredClone(original), publicName = "make" + name;
		fn.id = "lean:Owned." + publicName; fn.name = publicName;
		fn.overloadKey = "Owned." + publicName; fn.source.declaration = "Owned." + publicName;
		fn.parameters = []; fn.result.type = { kind: "named", id }; ir.declarations.push(fn);
		return { kind: "named", id };
	};
	const container = add("ContainerCallback", [bool, array, list, optional, tuple], list, 1);
	add("HigherCallback", [container], container); add("ScalarCallback", [bool], bool);
	return ir;
};

test("PHP callback-result anchors require explicit admission and preserve callback-local positions", () => {
	for(const variant of ["no-host", "host", "combined"])
	{
		const ir = fixtureFor(variant), original = structuredClone(ir), options = optionsFor(variant);
		assert.throws(() => generateOwnedPhpCalls(ir, { ...options, callbackResultAnchors: false }), /explicit output leases/u);
		const model = generateOwnedPhpPackage(ir, null, options);
		assert.deepEqual(ir, original); assert.deepEqual(model.files, generateOwnedPhpPackage(ir, null, options).files);
		assert.equal(model.wholeOwners, true); assert.equal(model.contract.schemaVersion, 5);
		assert.equal(model.functions.filter(fn => fn.anchor !== undefined).length, variant === "combined" ? 1 : 0);
		assert.equal(model.functions.filter(fn => fn.receiver === 0).length, variant === "combined" ? 5 : 0);
		assert.equal(model.functions.filter(fn => fn.transfers?.length).length, variant === "combined" ? 2 : 0);
		assert.equal(Boolean(model.contract.resultAnchors), variant === "combined");
		assert.equal(Boolean(model.contract.callbackResultAnchors.hostReplies), variant !== "no-host");
		assert.equal(JSON.parse(model.files["binding-manifest.json"]).schemaVersion, 5);
		assert.equal(auditOwnedPhpPackage(ir, model.files, options), true);
		const changes = [manifest => { manifest.schemaVersion = variant === "combined" ? 4 : 1; }
			, manifest => { delete manifest.contract.callbackResultAnchors; }
			, manifest => { manifest.contract.callbackResultAnchors.signatures[0].parameter++; }];
		for(const change of changes)
		{
			const files = { ...model.files }, manifest = JSON.parse(files["binding-manifest.json"]);
			change(manifest); files["binding-manifest.json"] = canonicalJson(manifest);
			assert.throws(() => auditOwnedPhpPackage(ir, files, options), /complete generated sources/u);
		}
		const callbacks = model.c.callbacks.filter(fn => fn.anchor !== undefined);
		assert.deepEqual(callbacks.map(fn => fn.anchor).sort(), [1, 1, 2, 2]);
		for(const callback of callbacks)
		{
			const index = model.c.functions.length + model.c.callbacks.indexOf(callback), call = model.calls[index];
			assert.equal(call.anchor, callback.anchor); assert.equal(call.parameters[callback.anchor].anchor, true);
			assert.equal(callback.parameters[0], callback.id); assert.notEqual(call.anchor, 0);
			assert.ok(model.c.header.includes(model.c.signature(callback) + ";"));
		}
		assert.equal(model.c.copies.length, 20);
		if(variant === "no-host")
		{
			assert.deepEqual(model.callbacks, {}); assert.doesNotMatch(model.c.header, /_host\b/u);
			assert.doesNotMatch(model.files["src/Api.php"], /WithRecovery|with_recovery/u);
		}
		else assert.equal(Object.values(model.callbacks).filter(fn => fn.anchor !== null).length, 4);
	}
});

test("PHP callback-only factories distinguish unnamed Array, List, Option and Tuple types", () => {
	for(const name of ["copyArg", "copyResult", "copy_arg", "copy_result"])
	{
		const collision = fixtureFor("combined");
		collision.declarations.find(fn => fn.receiver).name = name;
		assert.throws(() => generateOwnedPhpCalls(collision, optionsFor("combined")), /Reserved or duplicate PHP receiver member/u);
	}
	for(const hostCallbacks of [false, true])
	{
		const ir = factoryIr(), original = structuredClone(ir);
		const model = generateOwnedPhpCalls(ir, { callbackResultAnchors: true, hostCallbacks });
		assert.deepEqual(ir, original); assert.equal(model.c.callbacks.filter(fn => fn.anchor !== undefined).length, 1);
		assert.ok(model.functions.every(fn => !fn.parameters.length));
		const callback = model.c.callbacks.find(fn => fn.id === "bridge:ContainerCallback");
		const parameters = callback.parameters.slice(2).map(id => model.types.find(node => node.id === id));
		assert.deepEqual(parameters.map(node => node.kind), ["array", "list", "option", "tuple"]);
		assert.equal(parameters[0].publicType, parameters[1].publicType); assert.notEqual(parameters[0].index, parameters[1].index);
		const types = model.files["src/Internal/OwnedCallTypes.php"];
		assert.ok(types.includes(`'parameters' => [null, ${parameters.map(node => node.index).join(", ")}]`));
		assert.ok(types.includes(`'result' => ${parameters[1].index}`));
		assert.match(model.files["src/Api.php"], /function copyArg\(mixed \$index, mixed \$value\): Value/u);
		assert.match(model.files["src/Api.php"], /function copyResult\(mixed \$value\): Value/u);
		assert.doesNotMatch(model.files["src/Api.php"], /copy_arg|copy_result/u);
		const reordered = structuredClone(ir); reordered.types.reverse();
		assert.deepEqual(generateOwnedPhpCalls(reordered, { callbackResultAnchors: true, hostCallbacks }).files, model.files);
	}
});

test("PHP callback whole replies preserve native identity and pin the original owner before conversion", () => {
	const model = generateOwnedPhpCalls(fixtureFor("combined"), optionsFor("combined"));
	const runtime = model.files["src/Internal/OwnedCalls.php"], conversion = model.files["src/Internal/OwnedConversions.php"];
	const steps = ["$native = $callback;", "ValueAccess::snapshot($native, $type)", "if ($native instanceof Resource)", "self::callback($callback"];
	const positions = steps.map(step => runtime.indexOf(step));
	assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])));
	assert.match(runtime, /\$scope->wholeValue\(\$type, \$prepared\['closure'\]\)/u);
	assert.match(runtime, /\$scope->wholeValue\(\$cb\['result'\], \$prepared\['recovery'\]\)/u);
	assert.match(runtime, /\$frame->scope->wholeValue\(\$cb\['result'\], \$result\)/u);
	assert.match(runtime, /finally \{ \$borrow\?->close\(\); \}/u);
	assert.match(runtime, /\$lease->anchor = \$anchor/u);
	assert.match(runtime, /\$inputLeases\[\$fn\['anchor'\]\]->requireOpen\(\)/u);
	assert.ok(conversion.indexOf("ValueAccess::snapshot($value, $type)") < conversion.indexOf("$this->leases[] = new OwnedPin($lease)"));
	assert.match(conversion, /OwnedPin::closeAll\(\$this->leases\)/u);
});

test("PHP callback capability leaves predecessor generated sources byte-identical without anchors", () => {
	const variants = [[ownedAggregateReviewedIr, false]
		, [ownedAggregateReviewedIr, true]
		, [ownedRustTransferReviewedIr, true]
		, [ownedRustBorrowReviewedIr, true], [ownedRustReceiverReviewedIr, true]];
	for(const [fixture, hostCallbacks] of variants)
	{
		const ir = fixture(), options = { ...combinedOptions, hostCallbacks };
		const baseline = generateOwnedPhpPackage(ir, null, options);
		const enabled = generateOwnedPhpPackage(ir, null, { ...options, callbackResultAnchors: true });
		assert.deepEqual(enabled.files, baseline.files); assert.deepEqual(enabled.contract, baseline.contract);
		assert.equal(enabled.c.header, baseline.c.header); assert.equal(enabled.nativeSource, baseline.nativeSource);
	}
});

test("PHP callback-result sources parse and native callback signatures compile without Lean", { skip: !enabled }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-callback-signatures-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const models = ["no-host", "host", "combined"].map(variant => generateOwnedPhpCalls(fixtureFor(variant), optionsFor(variant)));
	for(const hostCallbacks of [false, true]) models.push(generateOwnedPhpCalls(factoryIr(), { callbackResultAnchors: true, hostCallbacks }));
	for(const model of models)
	{
		for(const [path, source] of Object.entries(model.files))
		{
			await saveLakeFile(directory, path, source);
			await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php8.2", ["-n", "-l", path], directory);
		}
		await saveLakeFile(directory, model.c.prefix + ".h", model.c.header);
		await saveLakeFile(directory, "callbacks.c", model.nativeSource);
		await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I", directory, "callbacks.c"], directory);
	}
	t.diagnostic("Five generated PHP/C models checked; no Lean build or installed-package execution.");
});

test("PHP callback factory and host-boundary checks execute with type-only FFI and no native functions", { skip: !enabled }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-callback-unit-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const model = generateOwnedPhpCalls(factoryIr(), { callbackResultAnchors: true, hostCallbacks: true });
	for(const [path, source] of Object.entries(model.files)) await saveLakeFile(directory, path, source);
	// Deliberate unit-test scaffolding, not compiled Lean or native ownership
	// evidence. Remove every function prototype, retaining only generated types.
	const definitions = model.definitions.split("\n").filter(line => line.startsWith("typedef")
		|| !/^[A-Za-z_][^;{}]*\([^{}]*\);$/u.test(line)).join("\n");
	assert.doesNotMatch(definitions, /_session_open\(|_result_validate\(|_php_integer_new\(/u);
	await saveLakeFile(directory, "types.ffi", definitions);
	await saveLakeFile(directory, "unit.php", callbackUnitProbe);
	const execution = await runCopied(process.env.LEAN_BRIDGE_PHP ?? "/usr/bin/php8.2"
		, ["-d", "ffi.enable=1", "-d", "display_errors=stderr", "unit.php"], directory);
	assert.equal(execution.stderr, "");
	const observed = JSON.parse(execution.stdout);
	assert.equal(observed.scope, "type-only-ffi-unit"); assert.equal(observed.nativeFunctions, 0);
	assert.ok(observed.checks >= 50); assert.equal(observed.selectors, 6);
	t.diagnostic(JSON.stringify(observed));
});

const callbackUnitProbe = String.raw`<?php
declare(strict_types=1);
require __DIR__ . '/src/Api.php';
use LeanOwnedAggregates\{ContainerCallback, ScalarCallback, Value, WithRecovery, LeanBridgeError};
use LeanOwnedAggregates\Internal\{Native, NativeBinding, Resource, ResourceAccess, ResourceBinding,
    GraphTypes, OwnedCallTypes, OwnedCalls, OwnedRuntime, OwnedState, OwnedLease, OwnedBorrowScope,
    OwnedBorrowFrame, OwnedSchema, OwnedConversionScope, OwnedConversions, OwnedCallFrame, ValueAccess};
$checks = 0; $loads = 0; $selectors = 0;
function check(bool $value, string $message): void {
    global $checks; $checks++; if (!$value) throw new RuntimeException($message);
}
function reject(Closure $call, string $class, ?int $code = null): void {
    try { $call(); } catch (Throwable $error) {
        check($error instanceof $class && ($code === null || $error->getCode() === $code), 'wrong rejection: ' . $error);
        return;
    }
    throw new RuntimeException('missing rejection');
}
function set(object $value, string $property, mixed $contents): void {
    (new ReflectionProperty($value, $property))->setValue($value, $contents);
}
function pins(OwnedLease $lease): int { return (new ReflectionProperty($lease, 'pins'))->getValue($lease); }
$ffi = FFI::cdef(file_get_contents(__DIR__ . '/types.ffi'));
$runtime = new OwnedRuntime($ffi);
// The fake session address is never dereferenced or passed to native code.
// This scaffold exercises PHP lifetime checks, FFI layout conversion and pins.
$state = (new ReflectionClass(OwnedState::class))->newInstanceWithoutConstructor();
set($state, 'runtime', $runtime); set($state, 'session', $ffi->cast('owned_aggregates_session *', 4096));
set($runtime, 'state', $state);
$schema = new OwnedSchema($ffi);
$type = GraphTypes::IDENTITIES[ContainerCallback::class];
$signature = OwnedCallTypes::CALLBACK_TYPES[$type];
$listType = $signature['result'];
$newLease = static fn() => new OwnedLease($state, new OwnedBorrowScope());
$noRetain = static fn() => throw new RuntimeException('unit scaffold cannot retain native results');
$newClosure = static function(?OwnedLease $lease = null) use ($newLease, $ffi, $noRetain): ContainerCallback {
    return ResourceAccess::wrap(ContainerCallback::class,
        new NativeBinding($lease ?? $newLease(), $ffi->cast('void *', 8192), $noRetain));
};
$closure = $newClosure();
Native::configure(static function() use (&$loads) { $loads++; throw new RuntimeException('checked-loader-boundary'); });
foreach (['1', 1.0, true, null, [], -1, 5, PHP_INT_MAX, 0] as $index)
    reject(fn() => $closure->copyArg($index, []), TypeError::class);
reject(fn() => $closure->copyArg(1), ArgumentCountError::class);
reject(fn() => $closure->copyResult([], []), ArgumentCountError::class);
check($loads === 0, 'invalid selectors must precede loader access');
foreach ([[1, []], [2, []], [3, null], [4, [[], []]]] as [$index, $empty]) {
    try { $closure->copyArg($index, $empty); }
    catch (RuntimeException $error) { check($error->getMessage() === 'checked-loader-boundary', 'owned selector'); $selectors++; }
}
try { $closure->copyResult([]); }
catch (RuntimeException $error) { check($error->getMessage() === 'checked-loader-boundary', 'result selector'); $selectors++; }
$wholeClosure = ValueAccess::wrap($newLease(), $type, $closure, $noRetain);
try { $wholeClosure->copyResult([]); }
catch (RuntimeException $error) { check($error->getMessage() === 'checked-loader-boundary', 'whole closure selector'); $selectors++; }
check($loads === 6 && $selectors === 6, 'exact selected loader calls');
$forged = (new ReflectionClass(ContainerCallback::class))->newInstanceWithoutConstructor();
reject(fn() => $forged->copyArg(1, []), TypeError::class);
reject(fn() => (new ReflectionMethod(ContainerCallback::class, 'copyArg'))->invoke(new stdClass(), 1, []), ReflectionException::class);
$forgedWhole = (new ReflectionClass(Value::class))->newInstanceWithoutConstructor();
reject(fn() => $forgedWhole->copyResult([]), LeanBridgeError::class, 4);
$closed = $newClosure(); $closed->close();
reject(fn() => $closed->copyResult([]), LeanBridgeError::class, 4);
$closedWhole = ValueAccess::wrap($newLease(), $type, $newClosure(), $noRetain); $closedWhole->close();
reject(fn() => $closedWhole->copyArg(1, []), LeanBridgeError::class, 4);
$empty = ValueAccess::wrap($newLease(), $listType, [], $noRetain);
reject(fn() => $empty->copyResult([]), TypeError::class);
$borrow = new OwnedBorrowFrame($state); $escaped = $newClosure($borrow->lease); $borrow->close();
reject(fn() => $escaped->copyResult([]), LeanBridgeError::class, 4);
check($loads === 6, 'invalid/closed factories did not load');

$engine = new OwnedCalls(static fn() => $runtime); set($engine, 'runtime', $runtime); set($engine, 'schema', $schema);
$validate = new ReflectionMethod(OwnedCalls::class, 'validate');
$fn = ['parameters' => [['type' => $type, 'host' => true]]];
$prepared = $validate->invoke(null, $fn, [$wholeClosure]);
check($prepared[0]['closure'] === $wholeClosure && !isset($prepared[0]['call']), 'whole native closure kept its identity');
reject(fn() => $validate->invoke(null, $fn, [new WithRecovery($wholeClosure, [])]), TypeError::class);
reject(fn() => $validate->invoke(null, $fn, [$closedWhole]), LeanBridgeError::class, 4);
$callback = static fn($bool, $array, $list, $optional, $tuple) => [];
$prepared = $validate->invoke(null, $fn, [new WithRecovery($callback, $empty)]);
check($prepared[0]['recovery'] === $empty, 'recovery root retained through preparation');
reject(fn() => $validate->invoke(null, $fn, [new WithRecovery($callback, $closedWhole)]), LeanBridgeError::class, 4);

foreach ([[1, []], [2, []], [3, null], [4, [[], []]]] as [$index, $payload]) {
    $lease = $newLease(); $containerType = $signature['parameters'][$index];
    $root = ValueAccess::wrap($lease, $containerType, $payload, $noRetain);
    $scope = new OwnedConversionScope($schema, $state);
    $raw = $scope->wholeValue($containerType, $root);
    check($raw === $payload && pins($lease) === 1, 'empty whole container pins its own owner');
    OwnedConversions::write($containerType, $raw, $scope);
    $root->close(); check(pins($lease) === 1, 'closed whole value keeps the scope pin until cleanup');
    reject(fn() => ValueAccess::snapshot($root, $containerType), LeanBridgeError::class, 4);
    $scope->close(); check(pins($lease) === 0, 'whole container pin cleaned');
}
$anchorLease = $newLease(); $anchor = ValueAccess::wrap($anchorLease, $listType, [], $noRetain);
$childLease = $newLease(); $childLease->anchor = $anchorLease;
$child = ValueAccess::wrap($childLease, $listType, [], $noRetain);
$anchor->close(); check($child->closed(), 'empty descendant follows original owner');
reject(fn() => $child->get(), LeanBridgeError::class, 4); $child->close();

$host = new ReflectionMethod(OwnedCalls::class, 'host');
$nativeScope = new OwnedConversionScope($schema, $state); $nativeFrame = new OwnedCallFrame($nativeScope);
$nativeDescriptor = $host->invoke($engine, $type, ['closure' => $wholeClosure], $nativeFrame);
check($schema->address($ffi->cast('lb_php_owned_bytes', $nativeDescriptor->closure)) === 8192, 'native descriptor identity');
check($nativeDescriptor->call === null && $nativeDescriptor->context === null, 'native closure was not replaced by PHP callback');
$nativeScope->close();
$replyLease = $newLease(); $reply = ValueAccess::wrap($replyLease, $listType, [], $noRetain);
$replyScope = new OwnedConversionScope($schema, $state); $replyFrame = new OwnedCallFrame($replyScope);
$arguments = [];
foreach ([false, [], [], null, [[], []]] as $index => $payload)
    $arguments[] = OwnedConversions::write(OwnedCallTypes::CALLBACKS[$type]['parameters'][$index], $payload, $replyScope);
$output = $replyScope->allocate($schema->nodes[$listType]['size']); $arguments[] = $output;
set($engine, 'contexts', [1 => [$type, static fn(...$args) => $reply, $replyFrame]]);
$invoke = new ReflectionMethod(OwnedCalls::class, 'invokeCallback');
check($invoke->invoke($engine, $type, $ffi->cast('void *', 1), $state->session, $arguments) === 0, 'whole host reply accepted');
check(pins($replyLease) === 1 && $replyFrame->failure === null, 'whole reply remains rooted after PHP callback return');
$reply->close(); check(pins($replyLease) === 1, 'whole reply storage stays pinned until caller cleanup');
$replyScope->close(); check(pins($replyLease) === 0, 'whole reply scope releases pin');
$rawScope = new OwnedConversionScope($schema, $state); $rawFrame = new OwnedCallFrame($rawScope); $captured = null;
$ticket = ResourceAccess::wrap(LeanOwnedAggregates\Ticket::class,
    new NativeBinding($newLease(), $ffi->cast('void *', 12288), $noRetain));
$rawArguments = [];
foreach ([false, [], [$ticket], null, [[], []]] as $index => $payload)
    $rawArguments[] = OwnedConversions::write(OwnedCallTypes::CALLBACKS[$type]['parameters'][$index], $payload, $rawScope);
$rawArguments[] = $rawScope->allocate($schema->nodes[$listType]['size']);
$rawCallback = static function($bool, $array, $list, $optional, $tuple) use (&$captured) { $captured = $list[0]; return []; };
set($engine, 'contexts', [2 => [$type, $rawCallback, $rawFrame]]);
check($invoke->invoke($engine, $type, $ffi->cast('void *', 2), $state->session, $rawArguments) === 0, 'raw host reply accepted');
check($captured instanceof LeanOwnedAggregates\Ticket, 'host received its raw borrowed argument');
reject(fn() => $captured->retain(), LeanBridgeError::class, 4);
set($engine, 'contexts', [3 => [$type, static fn(...$args) => $reply, $rawFrame]]);
check($invoke->invoke($engine, $type, $ffi->cast('void *', 3), $state->session, $rawArguments) === 10, 'closed whole reply rejects');
check($rawFrame->failure instanceof LeanBridgeError && $rawFrame->failure->getCode() === 4, 'exact closed reply error preserved');
$rawScope->close(); $ticket->close();
$recoveryLease = $newLease(); $recovery = ValueAccess::wrap($recoveryLease, $listType, [], $noRetain);
$recoveryScope = new OwnedConversionScope($schema, $state); $recoveryFrame = new OwnedCallFrame($recoveryScope);
$host->invoke($engine, $type, ['hasRecovery' => true, 'recovery' => $recovery, 'call' => $callback], $recoveryFrame);
check(pins($recoveryLease) === 1, 'whole recovery pins before native handoff');
$recovery->close(); check(pins($recoveryLease) === 1, 'recovery pin retains storage through descriptor use');
$recoveryScope->close(); check(pins($recoveryLease) === 0, 'recovery pin cleaned');
$empty->close(); $wholeClosure->close(); $closure->close(); $escaped->close();
echo json_encode(['scope' => 'type-only-ffi-unit', 'nativeFunctions' => 0, 'checks' => $checks, 'selectors' => $selectors]), "\n";
`;
