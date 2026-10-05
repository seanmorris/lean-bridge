/**
 * Independent captured Lean text generators for contract and compiled tests.
 *
 * @file
 */
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { prepareLakeDependencySnapshot } from "../../src/build/lake-dependency-snapshot.mjs";
import { lakeWorkspaceFixture, saveLakeFile } from "./lake-workspace.mjs";

/**
 * Make a captured data-to-Lean/header generator and an explicit internal recipe.
 *
 * @param t - Test context responsible for cleanup.
 * @param variant - Independent input value and package graph.
 */
export const lakeGeneratorFixture = async (t, variant = "shop") => {
	const context = await lakeWorkspaceFixture(t, variant);
	await saveLakeFile(context.root, "tools/GeneratorSupport.lean", 'def GeneratorSupport.clean (value : String) : String := value.trimAscii.toString\n');
	await saveLakeFile(context.root, "tools/TableGenerator.lean", `import GeneratorSupport
def TableGenerator.generate (inputs : Array (String × String)) (args : Array String)
    : Except String (Array (String × String)) := do
  let some (_, raw) := inputs[0]? | .error "missing value"
  let value := GeneratorSupport.clean raw
  let some suffix := args[0]? | .error "missing suffix"
  .ok #[("lean", s!"def Generated.value : UInt32 := {value}\\n"),
    ("header", s!"#define GENERATED_{suffix} {value}\\n")]
`);
	await saveLakeFile(context.root, "data/value.txt", variant === "shop" ? " 17\n" : " 29\n");
	const definition = { schemaVersion: 1, profile: "lean-text-v1", name: "table"
		, declaration: "TableGenerator.generate"
		, modules: [{ module: "GeneratorSupport", path: "root/tools/GeneratorSupport.lean" }, { module: "TableGenerator", path: "root/tools/TableGenerator.lean" }]
		, inputs: [{ name: "value", path: "root/data/value.txt" }]
		, arguments: ["VALUE"]
		, outputs: [{ name: "lean", path: "root/generated/Generated.lean" }, { name: "header", path: "root/native/generated.h" }] };
	const snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
	return { ...context, definition, snapshot };
};

/**
 * Declare a selected pure tool and an unrelated target whose body must not run.
 *
 * @param t - Test context responsible for cleanup.
 * @param variant - Independent source tree and generated value.
 */
export const lakeGeneratorPrerequisiteFixture = async (t, variant = "shop") => {
	const context = await lakeGeneratorFixture(t, variant);
	const { root, names, definition } = context;
	const recipe = { name: definition.name, profile: definition.profile
		, module: "TableGenerator", declaration: definition.declaration
		, inputs: definition.inputs.map(input => ({ ...input, path: input.path.slice(5) }))
		, arguments: definition.arguments
		, outputs: definition.outputs.map(output => ({ ...output, path: output.path.slice(5) })) };
	const unused = { ...recipe, name: "unused", module: "UnusedGenerator"
		, declaration: "UnusedGenerator.generate"
		, outputs: [{ name: "lean", path: "generated/Unused.lean" }] };
	const configuration = JSON.parse(await readFile(join(root, "lean-bridge.exports.json"), "utf8"));
	configuration.generators = [recipe, unused];
	await saveLakeFile(root, "lean-bridge.exports.json", JSON.stringify(configuration));
	await rm(join(root, "lakefile.toml"));
	const lakefile = `import Lake
open Lake DSL
package ${names.root.toLowerCase()} where
  version := v!"1.0.0"
require ${names.local} from "../local"
target table pkg : Unit := do
  IO.FS.writeFile (pkg.dir / "hook-ran") "selected hook ran"
  pure (Job.pure ())
target unused pkg : Unit := do
  IO.FS.writeFile (pkg.dir / "unused-hook-ran") "unused hook ran"
  pure (Job.pure ())
lean_lib GeneratorSupport where
  srcDir := "tools"
lean_lib TableGenerator where
  srcDir := "tools"
lean_lib Generated where
  srcDir := "generated"
lean_lib ${names.root} where
  needs := #[.packageTarget .anonymous \`table]
`;
	await saveLakeFile(root, "lakefile.lean", lakefile);
	await saveLakeFile(root, `${names.root}.lean`, `import Generated\nimport ${names.local}\nnamespace ${names.root}\ndef ${names.operation} (value : UInt32) : UInt32 := ${names.local}.${names.operation} value + Generated.value\nend ${names.root}\n`);
	const snapshot = await prepareLakeDependencySnapshot({ projectRoot: root, includeProject: true });
	return { ...context, recipe, configuration, lakefile, snapshot };
};

/**
 * Add imports visible only after generation and a generated C translation unit.
 *
 * @param t - Test context responsible for cleanup.
 * @param variant - Independent package graph and data value.
 */
export const generatedLakeWorkspaceFixture = async (t, variant = "shop") => {
	const context = await lakeGeneratorPrerequisiteFixture(t, variant);
	context.configuration.generators[0].outputs.push({ name: "native", path: "native/generated.c" });
	context.lakefile = context.lakefile.replace("lean_lib GeneratorSupport", 'input_file generatedC where\n  path := "native/generated.c"\nlean_lib Extra\nlean_lib GeneratorSupport')
		.replace("  needs := #[.packageTarget .anonymous `table]", "  needs := #[.packageTarget .anonymous `table]\n  moreLinkObjs := #[{ key := .packageTarget .anonymous `generatedC }]");
	await saveLakeFile(context.root, "Extra.lean", "def Extra.adjust (value : UInt32) : UInt32 := value + 3\n");
	const tool = `import GeneratorSupport
def TableGenerator.generate (inputs : Array (String × String)) (_args : Array String)
    : Except String (Array (String × String)) := do
  let some (_, raw) := inputs[0]? | .error "missing value"
  let value := GeneratorSupport.clean raw
  .ok #[("lean", s!"import Extra\\ndef Generated.value : UInt32 := Extra.adjust {value}\\n"),
    ("header", s!"#define GENERATED_VALUE {value}\\n"),
    ("native", "#include \\"generated.h\\"\\nunsigned generated_value(void) { return GENERATED_VALUE; }\\n")]
`;
	await saveLakeFile(context.root, "tools/TableGenerator.lean", tool);
	await saveLakeFile(context.root, "lean-bridge.exports.json", JSON.stringify(context.configuration));
	await saveLakeFile(context.root, "lakefile.lean", context.lakefile);
	context.snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
	return { ...context, tool };
};

/**
 * Generate the public module itself, with a compiler-inferred result and type alias.
 *
 * @param t - Test context responsible for cleanup.
 * @param variant - Independent source tree and generated value.
 */
export const generatedLakeEntryFixture = async (t, variant = "shop") => {
	const context = await generatedLakeWorkspaceFixture(t, variant);
	const { root, names } = context;
	await rm(join(root, `${names.root}.lean`));
	context.configuration.generators[0].outputs[0].path = `generated/${names.root}.lean`;
	context.lakefile = context.lakefile.replace(`lean_lib ${names.root} where`, `lean_lib ${names.root} where\n  srcDir := "generated"`);
	await saveLakeFile(root, "Extra.lean", "abbrev Extra.Amount := UInt32\ndef Extra.adjust (value : Extra.Amount) := value + 3\n");
	context.tool = context.tool.replace("import Extra\\ndef Generated.value : UInt32 := Extra.adjust {value}\\n",
		`import Extra\\nimport ${names.local}\\ndef ${names.root}.${names.operation} (value : Extra.Amount) := ${names.local}.${names.operation} value + Extra.adjust {value}\\n`);
	await saveLakeFile(root, "tools/TableGenerator.lean", context.tool);
	await saveLakeFile(root, "lean-bridge.exports.json", JSON.stringify(context.configuration));
	await saveLakeFile(root, "lakefile.lean", context.lakefile);
	context.snapshot = await prepareLakeDependencySnapshot({ projectRoot: root, includeProject: true });
	return context;
};
