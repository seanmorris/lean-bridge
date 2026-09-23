/**
 * Public recursive Ruby APIs and authenticated native package loading.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../capsule/node.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { generateCopiedRubyGraphValues } from "./copied-graph-values.mjs";
import { generateCopiedRubyGraphConversions } from "./copied-graph-conversions.mjs";
import { copiedRubyAssets, copiedRubyRuntime } from "./copied-assets.mjs";

/**
 * Check public declarations and dependency names before compiling a gem.
 *
 * @param ir - Compiler-checked finite copied graph contract.
 */
export const compileCopiedRubyGraphPackageModel = ir => {
	const values = generateCopiedRubyGraphValues(ir), prefix = values.layout.prefix;
	if(["gmp", "lean_bridge_native", "leanshared"].includes(prefix) || ir.component.id.length >= 160)
		throw new TypeError("Ruby graph component name collides with a dependency or exceeds its name limit");
	return { ...values, ir, prefix, layoutSha256: sha256(canonicalJson(values.layout)) };
};

/**
 * Export an allocation-free root release for pre-bound Fiddle calls.
 *
 * @param prefix - Checked C component identifier.
 */
export const rubyGraphClearSource = prefix => {
	if(!/^[a-z][a-z0-9_]*$/.test(prefix)) throw new TypeError("Invalid Ruby graph C prefix");
	return `#include <string.h>
void ${prefix}_ruby_graph_clear(void *value) {
  struct owner { void *pointer; void (*release)(void *); } owner;
  if (!value) return;
  memcpy(&owner, value, sizeof(owner));
  memset(value, 0, sizeof(owner));
  if (owner.pointer && owner.release) owner.release(owner.pointer);
}
`;
};

const publicSource = model => {
	const names = new Map(model.ir.types.map(type => [type.id, type.name]));
	const type = ref => ref.kind === "primitive" ? ref.name : ref.kind === "named" ? names.get(ref.id)
		: `${ref.constructor}<${ref.arguments.map(type).join(", ")}>`;
	return `${model.source}
module LeanBridge
  module ${model.componentName}
    class LeanBridgeError < ::StandardError
      attr_reader :status
      def initialize(status, message)
        super(message)
        @status = status
      end
    end
    module_function
${model.functions.map((fn, index) => `${fn.parameters.map((name, i) => `    # ${name}: ${type(fn.declaration.parameters[i].type)}`).join("\n")}
    # Returns: ${type(fn.declaration.result.type)}
    def ${fn.publicName}(${fn.parameters.join(", ")})
      Native.call${index}(${fn.parameters.join(", ")})
    end`).join("\n")}
  end
end
require_relative "${model.prefix}/native"
`;
};

const nativeSource = (model, evidence) => `${generateCopiedRubyGraphConversions(model.ir).source}
require "digest"
require "digest/sha2"
raise LoadError, "Lean graphs require Ruby 1:1 threads; unset RUBY_MN_THREADS" unless ENV.fetch("RUBY_MN_THREADS", "0").to_i.zero?
module LeanBridge
  module ${model.componentName}
    module Native
${copiedRubyAssets(model, evidence)}
      CLEAR = ::Fiddle::Function.new(LIBRARY["${model.prefix}_ruby_graph_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID, need_gvl: true)
      INITIALIZE = ::Fiddle::Function.new(LIBRARY["${model.prefix}_graph_initialize"], [], ::Fiddle::TYPE_INT, need_gvl: true)
      READY = ::Fiddle::Function.new(LIBRARY["${model.prefix}_graph_ready"], [], ::Fiddle::TYPE_INT, need_gvl: true)
      RETIRE = ::Fiddle::Function.new(LIBRARY["${model.prefix}_graph_retire"], [], ::Fiddle::TYPE_VOID, need_gvl: true)
      LIFECYCLE = [INITIALIZE, READY, RETIRE].freeze
${model.functions.map((fn, index) => `      CALL${index} = ::Fiddle::Function.new(LIBRARY["${fn.name}_graph"], [${Array(fn.parameters.length + 1).fill("::Fiddle::TYPE_VOIDP").join(", ")}], ::Fiddle::TYPE_INT, need_gvl: true)
      def call${index}(${fn.parameters.join(", ")})
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise LeanBridgeError.new(5, reason)
        end
        graph_call_${fn.publicName}(CALL${index}${fn.parameters.map(name => `, ${name}`).join("")}, clear: CLEAR, lifecycle: LIFECYCLE)
      end`).join("\n")}
    end
  end
end
`;

/**
 * Keep public Ruby values independent of private storage and lifecycle helpers.
 *
 * @param ir - Compiler-checked finite copied graph contract.
 * @param evidence - Verified native identities, or null for source inspection.
 */
export const generateCopiedRubyGraphPackage = (ir, evidence = null) => {
	const model = compileCopiedRubyGraphPackageModel(ir), entry = `lib/${model.requirePath}.rb`;
	const internal = `lib/${model.requirePath}/native.rb`, shared = "lib/lean_bridge/native_copied_runtime_v1.rb";
	const files = {
		[entry]: publicSource(model)
		, [internal]: nativeSource(model, evidence)
		, [shared]: copiedRubyRuntime
		, "README.md": `# ${model.namespace}

Install the prepared gem and require "${model.requirePath}". Native Lean libraries and a compatible shared runtime load automatically. Consumers need no Lean compiler or extension build. This package requires MRI Ruby 3.3 on little-endian Linux x86-64. Post-fork calls, Ractors and RUBY_MN_THREADS are rejected; start a fresh process after fork. Native libraries remain loaded for the process lifetime.

Records use frozen keyword-initialized classes. Variants use named constructors with required keyword payloads and Ruby pattern matching. Equality requires the exact generated class. Arrays and Lists use exact Ruby Arrays; copied results own independent storage. Concrete aliases retain their original names and targets in comments and metadata without adding wrapper classes. Unit is ${model.namespace}::UNIT. Options use nil or Some.new(value); Some.new(nil) differs from nil. Results use Ok.new(value) or Err.new(error), and products use nested two-element Arrays. Frozen fields may contain mutable arrays and strings; do not mutate inputs during conversion or while their enclosing values are Hash keys.

Integers remain exact. Nat rejects negatives, fixed-width integers reject out-of-range values, and native words are 64-bit. Numeric coercions and subclasses are rejected. Float32 rounds to binary32 and preserves NaN classification, infinity and signed zero. String requires valid UTF-8 or US-ASCII and preserves NUL. ByteArray uses a binary String. Char requires one Unicode scalar.

Input and output conversion share a maximum depth of 128, 262,144 nodes, a 16 MiB native-copy budget and a separate 16 MiB accounted conversion-storage budget. These limits do not bound Lean working memory or every Ruby allocator overhead. Cycles and uninhabited copied values reject. All inputs validate before native allocation or runtime initialization. An ensure block clears native outputs and temporary storage, including allocation failures and interruptions. Malformed native results retire the runtime; recoverable input, limit and allocation errors preserve usability. Independent calls may use Ruby threads; native calls retain the GVL. Domain errors return Err; bridge failures raise LeanBridgeError with a numeric status.

Callback, closure, resource and asynchronous payloads remain outside this recursive profile.

${model.functions.map(fn => `- ${model.namespace}.${fn.publicName}: ${fn.bindingId}`).join("\n")}
` };
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1
		, generator: "ruby-copied-graph-v1"
		, target: "ruby"
		, component: ir.component.id
		, bindingIrSha256: hashBindingIr(ir), namespace: model.namespace
		, files: Object.keys(files)
		, publicFiles: [entry]
		, internalFiles: [internal, shared]
		, packageFiles: []
		, exports: ["LeanBridgeError", ...model.exports, ...model.functions.map(fn => fn.publicName)]
		, aliases: model.aliases
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, supportedFeatures: ["direct-functions", "copied-values", "recursive-values", "deterministic-close"]
		, capabilityGaps: [{ feature: "identity-and-effects", reason: "Recursive Ruby packages support finite copied values; callables, resources and asynchronous operations remain outside this profile." }
			, { feature: "additional-platforms", reason: "The accepted native profile is MRI Ruby 3.3 on Linux x86-64 with 1:1 threads." }] }, null, 2)}\n`;
	return Object.freeze(files);
};
