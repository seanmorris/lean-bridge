/**
 * Independent nominal and structural stress cases for PHP copied declarations.
 *
 * @file
 */
import { recursiveReviewedIr } from "./recursive-fixture.mjs";

/** A recursive record has an inhabited optional tail. */
export const phpLinkedGraphIr = () => {
	const ir = recursiveReviewedIr(), record = ir.types.find(type => type.kind === "record");
	ir.component.id = "linked@1.0.0"; ir.component.name = "linked";
	const root = { kind: "named", id: "lean:Recursive.Link" };
	ir.types = [{ ...record, id: root.id, name: "Link"
		, fields: [
			{ ...record.fields[0], name: "tail", type: { kind: "apply", constructor: "option", arguments: [root] } }
			, { ...record.fields[0], name: "value", type: { kind: "primitive", name: "uint32" } }
		]
	}];
	ir.declarations = [ir.declarations[0]];
	ir.declarations[0].parameters[0].type = root; ir.declarations[0].result.type = root;
	return ir;
};

/**
 * Structural type spelling has a separate bound from nominal value depth.
 *
 * @param depth - Number of Array wrappers around the scalar field.
 */
export const phpDeepGraphIr = (depth = 32) => {
	const ir = phpLinkedGraphIr(); ir.component.id = "deep@1.0.0"; ir.component.name = "deep";
	let type = { kind: "primitive", name: "uint32" };
	for(let index = 0; index < depth; index++) type = { kind: "apply", constructor: "array", arguments: [type] };
	ir.types[0].fields = [{ ...ir.types[0].fields[0], name: "value", type }];
	return ir;
};

/** Public names must not shadow private traversal or globally qualified PHP. */
export const phpGraphNamingIr = () => {
	const ir = phpLinkedGraphIr(); ir.component.id = "names@1.0.0"; ir.component.name = "names";
	ir.types[0].name = "GraphTypes";
	for(const name of ["Values", "GraphBudget", "GraphScalars", "ReflectionReference", "TypeError", "Unit", "Match"])
		ir.types.push({ ...structuredClone(ir.types[0]), id: `lean:Recursive.${name}`, name, fields: [] });
	return ir;
};

/** Pure PHP probes are shared by native and actual WebAssembly interpreters. */
export const phpExtraGraphValues = String.raw`
require __DIR__ . '/linked/src/Api.php';
require __DIR__ . '/deep/src/Api.php';
require __DIR__ . '/names/src/Api.php';
require __DIR__ . '/names/shadow.php';
$linked = new LeanLinked\Link(null, exact('42', 32, true));
for ($index = 0; $index < 63; $index++) $linked = new LeanLinked\Link(new LeanLinked\Some($linked), exact('42', 32, true));
check($linked->equals($linked)); check(strlen($linked->hashCode()) === 64);
reject(fn() => new LeanLinked\Link(new LeanLinked\Some($linked), exact('42', 32, true)), ValueError::class, '128 levels');
$deep = exact('42', 32, true); for ($index = 0; $index < 32; $index++) $deep = [$deep];
check((new LeanDeep\Link($deep))->equals(new LeanDeep\Link($deep)));
check((new LeanDeep\Link($deep))->hashCode() === (new LeanDeep\Link($deep))->hashCode());
check((new LeanNames\GraphTypes(null, exact('42', 32, true)))->equals(new LeanNames\GraphTypes(null, exact('42', 32, true))));
check(count(LeanNames\Bytes::fromString('abc')) === 3);
check((new LeanNames\Some(null))->equals(new LeanNames\Some(null)));
foreach ([LeanNames\Values::class, LeanNames\GraphBudget::class, LeanNames\GraphScalars::class,
    LeanNames\ReflectionReference::class, LeanNames\TypeError::class, LeanNames\Unit::class, LeanNames\Match_::class] as $class) {
    check((new $class())->equals(new $class())); check((new $class())->hashCode() === (new $class())->hashCode());
}
`;

/** Public functions cannot intercept built-ins used by generated value classes. */
export const phpShadowFunctions = String.raw`<?php
namespace LeanNames;
function strlen(mixed $value): never { throw new \RuntimeException('Shadowed strlen'); }
function is_string(mixed $value): never { throw new \RuntimeException('Shadowed is_string'); }
function func_num_args(): never { throw new \RuntimeException('Shadowed func_num_args'); }
`;
