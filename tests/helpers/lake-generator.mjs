/**
 * Independent captured Lean text generators for contract and compiled tests.
 *
 * @file
 */
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
