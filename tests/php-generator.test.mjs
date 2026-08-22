/**
 * Tests the PHP generator behavior.
 *
 * @file
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { alpha } from "../poc/lean-link-spike/descriptors.mjs";
import {
	PhpBindingGenerationError,
	compilePhpPackageModel,
	generatePhpBindingPackage,
	renderPhpPackageLayout,
} from "../src/backends/php/generate.mjs";
import {
	PhpPackageAuditError,
	auditPhpPackage,
} from "../src/backends/php/package-audit.mjs";

const run = promisify(execFile);
const clone = value => structuredClone(value);
const sha256 = source => createHash("sha256").update(source, "utf8").digest("hex");

test("PHP model and render stages preserve audited package bytes", () => {
	const model = compilePhpPackageModel(alpha.bindingIr);
	const files = renderPhpPackageLayout(model);
	assert.deepEqual(files, generatePhpBindingPackage(alpha.bindingIr));
	assert.doesNotThrow(() => auditPhpPackage(alpha.bindingIr, files));
});

const writePackage = async (directory, files) => {
	for(const [relativePath, source] of Object.entries(files))
	{
		const destination = join(directory, relativePath);
		await mkdir(dirname(destination), { recursive: true });
		await writeFile(destination, source);
	}
};

const phpFiles = async directory => {
	const result = [];
	const visit = async path => {
		for(const entry of await readdir(path, { withFileTypes: true }))
		{
			const child = join(path, entry.name);
			if(entry.isDirectory()) await visit(child);
			else if(entry.name.endsWith(".php")) result.push(child);
		}
	};
	await visit(directory);
	return result.sort();
};

const deliveryFixture = () => {
	const ir = clone(alpha.bindingIr);
	const source = ir.declarations.find(declaration => declaration.id === "lean:Alpha.roundTrip");
	const promise = clone(source);
	promise.id = "bridge:Alpha.roundTripAsync";
	promise.name = "roundTripAsync";
	promise.overloadKey = "roundTripAsync(Payload)";
	promise.resultMode = "promise";
	promise.effects.push("async");
	promise.assurance = [];
	promise.source.producer = "bridge";
	promise.source.declaration = "Alpha.roundTripAsync";

	const iterator = clone(source);
	iterator.id = "bridge:Alpha.payloads";
	iterator.name = "payloads";
	iterator.overloadKey = "payloads(Payload)";
	iterator.resultMode = "iterator";
	iterator.assurance = [];
	iterator.source.producer = "bridge";
	iterator.source.declaration = "Alpha.payloads";
	ir.declarations.push(promise, iterator);
	return ir;
};

const propertyFixture = () => {
	const ir = clone(alpha.bindingIr);
	ir.types.find(type => type.id === "lean:Alpha.Box").mutability = "write";
	const getter = ir.declarations.find(declaration => declaration.id === "lean:Alpha.Box.read");
	getter.name = "value";
	getter.kind = "property";
	getter.overloadKey = "Box.value.get";
	const setter = clone(getter);
	setter.id = "bridge:Alpha.Box.setValue";
	setter.overloadKey = "Box.value.set(uint32)";
	setter.parameters = [{
		name: "value"
		, type: { kind: "primitive", name: "uint32" }
		, ownership: "copy"
		, lifetime: null
		, mutability: "immutable"
		, optional: false
		, default: null
	}];
	setter.result = { type: { kind: "primitive", name: "unit" }, ownership: "copy", lifetime: null };
	setter.receiver.mutability = "write";
	setter.mutability = "write";
	setter.effects = ["writes-resource", "fails"];
	setter.assurance = [];
	setter.documentation = { summary: "Replace the Box value.", details: "" };
	setter.source = {
		producer: "bridge"
		, declaration: "Alpha.Box.setValue"
		, extensions: { "lean-wasm.org/intrinsic": "property-setter-probe" }
	};
	ir.declarations.push(setter);
	return ir;
};

test("PHP generator emits one hash-bound Composer package with typed public stubs", () => {
  const files = generatePhpBindingPackage(alpha.bindingIr);
  assert.deepEqual(files, generatePhpBindingPackage(clone(alpha.bindingIr)));
  const manifest = JSON.parse(files["binding-manifest.json"]);
  const composer = JSON.parse(files["composer.json"]);
  const reflection = JSON.parse(files["reflection.json"]);
  const gaps = JSON.parse(files["capability-gaps.json"]);

  assert.equal(composer.name, "poc/lean-alpha");
  assert.equal(composer.autoload["psr-4"]["LeanAlpha\\"], "src/");
  assert.deepEqual(composer.autoload.files, ["src/functions.php"]);
  assert.equal(composer.extra["lean-bridge"].stub, "stubs/lean_alpha.php");
  assert.equal(manifest.bindingIrSha256, alpha.bindingIrSha256);
  assert.equal(manifest.transportInterface, "LeanAlpha\\Internal\\Transport");
  assert.equal(manifest.exports.includes("LeanAlpha\\Bytes"), true);
  assert.equal(manifest.exports.includes("LeanAlpha\\Box"), true);
  assert.equal(manifest.exports.includes("LeanAlpha\\roundTrip"), true);
  assert.equal(reflection.operations.length, alpha.bindingIr.declarations.length);
  assert.equal(gaps.supported, true);
  assert.equal(gaps.transportSelectionRequired, true);
  assert.deepEqual(gaps.capabilityGaps, []);

  const stub = files[manifest.stub];
  assert.match(stub, /final readonly class Payload/);
  assert.match(stub, /function roundTrip\(\\LeanAlpha\\Payload \$payload\): \\LeanAlpha\\Payload/);
  assert.match(stub, /final class Transform[\s\S]*function __invoke\(int \$value\): int/);
  assert.doesNotMatch(stub, /\bmixed\b|Internal\\Identity|\b(?:ccall|dispatch|handle|pointer)\b/i);
  assert.match(files["src/Internal/Transport.php"], /function leanAlphaRoundTrip\(\\LeanAlpha\\Payload \$payload\): \\LeanAlpha\\Payload/);
  assert.match(files["src/Internal/Transport.php"], /function transformCall\(\\LeanAlpha\\Internal\\Identity \$self, int \$value\): int/);
  assert.doesNotMatch(files["src/Internal/Transport.php"], /function (?:dispatch|invoke)\(/i);
  assert.match(files["README.md"], /roundTrip\(new \\LeanAlpha\\Payload\(false, 1, 'example', \\LeanAlpha\\Bytes::fromString/);
  assert.doesNotMatch(files["README.md"], /\.\.\./);
});

test("every generated PHP source file and the public stub pass the PHP parser", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-lint-"));
  try
{
    await writePackage(directory, generatePhpBindingPackage(alpha.bindingIr));
    for(const path of await phpFiles(directory))
{
      const { stdout } = await run("php", ["-l", path]);
      assert.match(stdout, /No syntax errors detected/);
}
} finally
{
    await rm(directory, { recursive: true, force: true });
}
});

test("generated PHP executes through ordinary values, functions, resources, and callables", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-run-"));
  try
{
    await writePackage(directory, generatePhpBindingPackage(alpha.bindingIr));
    await run("composer", ["dump-autoload", "--quiet", "--no-interaction"], { cwd: directory });
    await writeFile(join(directory, "FakeTransport.php"), `<?php
declare(strict_types=1);
namespace Test;

use LeanAlpha\\Internal\\Identity;
use LeanAlpha\\Internal\\Transport;
use LeanAlpha\\Internal\\TransportError;
use LeanAlpha\\Payload;

final class FakeTransport implements Transport
{
    public int $initializations = 0;
    public int $boxDisposals = 0;
    public int $transformDisposals = 0;
    public bool $failRead = false;
    private int $next = 0;

    public function initialize(): void { $this->initializations++; }
    public function leanAlphaBox(int $value): Identity { return new Identity('Box', 'box:' . ++$this->next, $value); }
    public function leanAlphaBoxRead(Identity $self): int
    {
        if ($this->failRead) { throw new TransportError('error:unknown'); }
        return (int) $self->value();
    }
    public function bridgeAlphaBoxIdentity(Identity $self): Identity { return $self; }
    public function leanAlphaRoundTrip(Payload $payload): Payload
    {
        return new Payload(!$payload->enabled, $payload->count + 1, $payload->label, $payload->bytes, $payload->values);
    }
    public function leanAlphaWithCallback(int $value, callable $transform): int { return $transform($value + 1) + 1; }
    public function leanAlphaMakeAdder(int $base): Identity { return new Identity('Transform', 'transform:' . ++$this->next, $base); }
    public function boxClose(Identity $self): void { $this->boxDisposals++; }
    public function transformCall(Identity $self, int $value): int { return (int) $self->value() + $value; }
    public function transformClose(Identity $self): void { $this->transformDisposals++; }
}
`);
    await writeFile(join(directory, "consumer.php"), `<?php
declare(strict_types=1);
require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/FakeTransport.php';

use LeanAlpha\\Box;
use LeanAlpha\\Bytes;
use LeanAlpha\\DisposedResource;
use LeanAlpha\\Internal\\Runtime;
use LeanAlpha\\Payload;
use Test\\FakeTransport;
use function LeanAlpha\\makeAdder;
use function LeanAlpha\\roundTrip;
use function LeanAlpha\\withCallback;

$transport = new FakeTransport();
Runtime::install($transport);
$box = new Box(41);
$same = $box->identity();
$payload = roundTrip(new Payload(false, 8, 'typed', Bytes::fromString("\\x00\\x7f\\xff"), [1, 5, 13]));
$adder = makeAdder(2);
$trace = [
    'read' => $box->read(),
    'identity' => $same === $box,
    'payload' => [
        'enabled' => $payload->enabled,
        'count' => $payload->count,
        'label' => $payload->label,
        'bytes' => bin2hex($payload->bytes->toString()),
        'values' => $payload->values,
    ],
    'callback' => withCallback(40, static fn(int $value): int => $value),
    'closure' => $adder(40),
];
$adder->close();
$box->close();
try {
    $box->read();
    $trace['disposed'] = false;
} catch (DisposedResource) {
    $trace['disposed'] = true;
}
$trace['runtime'] = [
    'initializations' => $transport->initializations,
    'boxDisposals' => $transport->boxDisposals,
    'transformDisposals' => $transport->transformDisposals,
];
echo json_encode($trace, JSON_THROW_ON_ERROR);
`);
    const { stdout } = await run("php", ["consumer.php"], { cwd: directory });
    assert.deepEqual(JSON.parse(stdout), {
      read: 41
      , identity: true
      , payload: { enabled: true, count: 9, label: "typed", bytes: "007fff", values: [1, 5, 13] }
      , callback: 42
      , closure: 42
      , disposed: true
      , runtime: { initializations: 1, boxDisposals: 1, transformDisposals: 1 }
    });
    await writeFile(join(directory, "poison.php"), `<?php
declare(strict_types=1);
require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/FakeTransport.php';

use LeanAlpha\\Box;
use LeanAlpha\\Internal\\Runtime;
use LeanAlpha\\UnexpectedError;
use Test\\FakeTransport;

$transport = new FakeTransport();
Runtime::install($transport);
$box = new Box(41);
$transport->failRead = true;
$trace = [];
try { $box->read(); } catch (UnexpectedError) { $trace[] = 'poisoned'; }
try { $box->read(); } catch (UnexpectedError) { $trace[] = 'terminal'; }
echo json_encode($trace, JSON_THROW_ON_ERROR);
`);
    const poison = await run("php", ["poison.php"], { cwd: directory });
    assert.deepEqual(JSON.parse(poison.stdout), ["poisoned", "terminal"]);
} finally
{
    await rm(directory, { recursive: true, force: true });
}
});

test("PHP properties, iterators, and awaitables retain native syntax", async () => {
  const propertyFiles = generatePhpBindingPackage(propertyFixture());
  assert.match(propertyFiles["src/Box.php"], /function __get\(string \$name\): mixed/);
  assert.match(propertyFiles["src/Box.php"], /function __set\(string \$name, mixed \$value\): void/);
  assert.match(propertyFiles["stubs/lean_alpha.php"], /@property int<0, 4294967295> \$value/);
  assert.match(propertyFiles["src/Box.php"], /case 'value':[\s\S]*catch \(TransportError \$error\)[\s\S]*DisposedResource/);

  const deliveryFiles = generatePhpBindingPackage(deliveryFixture());
  assert.equal("src/Awaitable.php" in deliveryFiles, true);
  assert.match(deliveryFiles["src/functions.php"], /function roundTripAsync\([^)]*\): \\LeanAlpha\\Awaitable/);
  assert.match(deliveryFiles["src/functions.php"], /function payloads\([^)]*\): \\Traversable/);

  const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-shapes-"));
  try
{
    await writePackage(directory, { ...propertyFiles, ...Object.fromEntries(Object.entries(deliveryFiles).map(([path, source]) => [`delivery/${path}`, source])) });
    for(const path of await phpFiles(directory)) await run("php", ["-l", path]);
} finally
{
    await rm(directory, { recursive: true, force: true });
}
});

test("PHP package audit rejects generated drift and raw public dispatch", async () => {
  const files = generatePhpBindingPackage(alpha.bindingIr);
  const drifted = { ...files, "stubs/lean_alpha.php": `${files["stubs/lean_alpha.php"]}\n// edited\n` };
  assert.throws(
    () => auditPhpPackage(alpha.bindingIr, drifted),
    error => error instanceof PhpPackageAuditError && error.code === "generated-file-drift",
  );

  const leaked = { ...files, "stubs/lean_alpha.php": `${files["stubs/lean_alpha.php"]}\nfunction dispatch(int $value): int {}\n` };
  const manifest = JSON.parse(leaked["binding-manifest.json"]);
  manifest.filesSha256["stubs/lean_alpha.php"] = sha256(leaked["stubs/lean_alpha.php"]);
  leaked["binding-manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
  assert.throws(
    () => auditPhpPackage(alpha.bindingIr, leaked),
    error => error instanceof PhpPackageAuditError && error.code === "raw-dispatch",
  );

  const incomplete = { ...files };
  const incompleteManifest = JSON.parse(incomplete["binding-manifest.json"]);
  delete incompleteManifest.filesSha256["src/Box.php"];
  incomplete["binding-manifest.json"] = `${JSON.stringify(incompleteManifest, null, 2)}\n`;
  assert.throws(
    () => auditPhpPackage(alpha.bindingIr, incomplete),
    error => error instanceof PhpPackageAuditError && error.code === "manifest-hash-coverage-drift",
  );
});

test("unsupported PHP semantics fail before package emission", () => {
  const generic = clone(alpha.bindingIr);
  const declaration = generic.declarations.find(item => item.id === "lean:Alpha.roundTrip");
  declaration.typeParameters = [{ id: "T", representation: "copied", constraints: [] }];
  declaration.parameters[0].type = { kind: "parameter", id: "T" };
  declaration.result.type = { kind: "parameter", id: "T" };
  declaration.source.extensions["lean-wasm.org/specializations"] = [
    { id: "uint32", type: { kind: "primitive", name: "uint32" } }
  ];
  assert.throws(
    () => generatePhpBindingPackage(generic),
    error => error instanceof PhpBindingGenerationError && error.code === "unsupported-generic-declaration",
  );

  const nullable = clone(alpha.bindingIr);
  const field = nullable.types.find(type => type.id === "lean:Alpha.Payload").fields[0];
  field.type = {
    kind: "apply"
    , constructor: "option"
    , arguments: [{
      kind: "apply"
      , constructor: "option"
      , arguments: [{ kind: "primitive", name: "uint32" }]
    }]
  };
  assert.throws(
    () => generatePhpBindingPackage(nullable),
    error => error instanceof PhpBindingGenerationError && error.code === "ambiguous-nullable-option",
  );
});
