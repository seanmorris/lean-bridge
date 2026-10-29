/**
 * Check the compiled component's exported API and native import interfaces.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Inspect wasm-tools JSON instead of assuming functions are flat world exports.
 * Exact source and type definitions are separately authenticated by the package checker.
 *
 * @param document - Actual compiled component, decoded by the selected wasm-tools.
 * @param projection - Projection of the independently checked compiler model.
 */
export const assertNominalSubtypeWitInterfaces = (document, projection) => {
	assert.equal(document.worlds.length, 1); assert.equal(document.interfaces.length, 2);
	const world = document.worlds[0], expected = projection.surface.functions;
	const typeName = reference => {
		if(typeof reference === "string") return reference;
		assert.ok(Number.isSafeInteger(reference) && reference >= 0);
		const type = document.types[reference]; assert.ok(type && typeof type.name === "string"); return type.name;
	};
	for(const [direction, name] of [["imports", "native"], ["exports", "api"]])
	{
		const selected = document.interfaces.flatMap((item, index) => item.name === name ? [index] : []);
		assert.equal(selected.length, 1); const index = selected[0], item = document.interfaces[index];
		assert.deepEqual(world[direction], { [`interface-${index}`]: { interface: { id: index } } });
		assert.equal(document.packages[item.package].name, projection.manifest.wit.package);
		assert.deepEqual(Object.keys(item.functions).sort(), expected.map(fn => fn.witName).sort());
		for(const fn of expected)
		{
			const actual = item.functions[fn.witName]; assert.equal(actual.name, fn.witName); assert.equal(actual.kind, "freestanding");
			assert.deepEqual(actual.params.map(site => ({ name: site.name, type: typeName(site.type) })), fn.parameters.map(site => ({ name: site.witName, type: site.copy.wit })));
			assert.equal(typeName(actual.result), fn.resultCopy.wit);
		}
	}
};
