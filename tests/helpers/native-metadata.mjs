/**
 * Synthetic shared native metadata for Node-only contract checks.
 *
 * @file
 */
import { createMetadataRequest } from "../../src/analyze/elaborated-metadata.mjs";

/** Build a closed report with explicit synthetic compiler and source identities. */
export const nativeMetadataFixture = () => {
	const type = { kind: "primitive", name: "uint32", lean: "UInt32", abi: { cType: "uint32_t", box: "lean_box_uint32", unbox: "lean_unbox_uint32", heap: false } };
	const selection = { profile: "native-library-v1", modules: ["Sample"], exportModules: ["Sample"], exports: ["Sample.increment"], resources: [], arities: [] };
	const sourceIdentity = { leanVersion: "4.32.2", leanCommit: "a".repeat(40)
		, sourceTreeSha256: "a".repeat(64), leanCompilerSha256: "b".repeat(64)
		, extractorSha256: "c".repeat(64)
		, exportConfigurationSha256: "d".repeat(64)
		, modules: [{ module: "Sample"
			, source: { path: "Sample.lean", bytes: 80, sha256: "e".repeat(64) }
			, interface: { bytes: 100, sha256: "f".repeat(64), interfaceSha256: "1".repeat(64) } }] };
	const modules = [{ name: "Sample", sourcePath: "Sample.lean", sourceSha256: "e".repeat(64), interfaceSha256: "1".repeat(64) }];
	const request = createMetadataRequest(selection, { toolchain: "leanprover/lean4:v4.32.2"
		, modules, leanCompilerSha256: sourceIdentity.leanCompilerSha256
		, extractorSha256: sourceIdentity.extractorSha256 });
	const metadata = { schemaVersion: 2, kind: "lean-bridge-elaborated-exports"
		, profile: "native-library-v1"
		, producer: { adapter: "lean-bridge-elaborator", adapterVersion: 2
			, tool: "Lean", toolVersion: "4.32.2"
			, toolchain: request.metadata.toolchain
			, invocationIdentitySha256: request.metadata.invocationIdentitySha256 }
		, modules: [{ ...modules[0], directImports: ["Init"]
			, declarations: [{ identity: "Sample.increment", kind: "definition"
				, visibility: "public", selected: true
				, source: { path: "Sample.lean", startLine: 2, startColumn: 0, endLine: 2, endColumn: 70 }
				, documentation: "Increment a word.", typeExpression: "UInt32 → UInt32"
				, parameters: [{ name: "value", binderInfo: "explicit", typeExpression: "UInt32" }]
				, resultExpression: "UInt32"
				, effects: [], theoremReferences: ["Sample.increment_spec"]
				, projection: { status: "supported", bindingShape: "native-function", parameters: [{ name: "value", type }], result: type }
			}]
		}]
		, diagnostics: [] };
	return { metadata, sourceIdentity: { ...sourceIdentity, request } };
};
