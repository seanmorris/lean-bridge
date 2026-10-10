/**
 * Public recursive Ruby callbacks and authenticated native package loading.
 * Consumers use Ruby values and owned closures without native declarations.
 *
 * @file
 */
import { copiedRubyAssets, copiedRubyRuntime } from "./copied-assets.mjs";
import { rubyClosurePublic } from "./callables.mjs";
import { generateCallableRubyGraphConversions } from "./callable-graph-conversions.mjs";
import { hashBindingIr } from "../../binding-ir/canonical.mjs";

/**
 * Keep the public API independent of private Fiddle storage and lease tokens.
 *
 * @param ir - Checked copied and synchronous callable Binding IR.
 * @param evidence - Verified native identities, or null for source inspection.
 */
export const generateCallableRubyGraphPackage = (ir, evidence = null) => {
	const { model, source, constants, methods } = generateCallableRubyGraphConversions(ir);
	const publicFunctions = model.functions.map(fn => {
		const block = !!fn.parameters.at(-1)?.callback;
		const args = fn.parameters.map((_, i) => "arg" + i), ordinary = block ? args.slice(0, -1) : args;
		return `    def ${fn.publicName}(${[...ordinary, ...block ? ["*callback", "&block"] : []].join(", ")})
${block ? `      raise ArgumentError, "Pass one callback argument or one block" unless callback.length == (block ? 0 : 1)\n      ${args.at(-1)} = block || callback[0]\n` : ""}      Native.call${fn.index}(${args.join(", ")})
    end`;
	}).join("\n");
	const files = {
		[`lib/${model.requirePath}.rb`]: `${model.source}
module LeanBridge
  module ${model.componentName}
    class LeanBridgeError < ::StandardError
      attr_reader :status
      def initialize(status, message)
        super(message)
        @status = status
      end
    end
${rubyClosurePublic}
    module_function
${publicFunctions}
  end
end
require_relative "${model.prefix}/native"
`
		, [`lib/${model.requirePath}/native.rb`]: `${source}
require "digest"
require "digest/sha2"
require "monitor"
raise LoadError, "Lean graphs require Ruby 1:1 threads; unset RUBY_MN_THREADS" unless ENV.fetch("RUBY_MN_THREADS", "0").to_i.zero?
module LeanBridge
  module ${model.componentName}
    module Native
${copiedRubyAssets(model, evidence)}
      CLEAR = ::Fiddle::Function.new(LIBRARY["${model.prefix}_ruby_graph_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID, need_gvl: true)
      INITIALIZE = ::Fiddle::Function.new(LIBRARY["${model.prefix}_graph_initialize"], [], ::Fiddle::TYPE_INT, need_gvl: true)
      READY = ::Fiddle::Function.new(LIBRARY["${model.prefix}_graph_ready"], [], ::Fiddle::TYPE_INT, need_gvl: true)
      RETIRE = ::Fiddle::Function.new(LIBRARY["${model.prefix}_graph_retire"], [], ::Fiddle::TYPE_VOID, need_gvl: true)
${constants}
${methods}
    end
  end
end
`
		, "lib/lean_bridge/native_copied_runtime_v1.rb": copiedRubyRuntime
		, "README.md": `# ${model.namespace}

Install the prepared gem and require "${model.requirePath}". The gem includes its native Lean libraries and loads a compatible shared runtime automatically. Consumers need no Lean compiler, native declarations or extension build. The native profile is MRI Ruby 3.3 on little-endian Linux x86-64 with 1:1 threads. Post-fork calls, Ractors and RUBY_MN_THREADS are rejected.

Records and variant constructors are frozen classes with required keyword fields. Arrays and Lists use exact Ruby Arrays and return independent copied storage. Concrete aliases retain their names and targets without wrapper classes. Unit is ${model.namespace}::UNIT. Options use nil or Some.new(value), including Some.new(nil). Results use Ok.new(value) or Err.new(error), and products remain nested pairs. Frozen fields can contain mutable arrays and strings; do not mutate inputs during conversion or while using them as Hash keys.

Pass a synchronous callable, method object or block to a callback parameter. Each invocation receives independently copied values. Ruby exceptions return after native cleanup. Non-local throw, break and return are contained and reported as LocalJumpError. Borrowed callbacks expire when the exporting call returns. Another Fiber cannot enter Lean while a native call is suspended on the same thread.

Returned LeanClosure values own their captures. Use with { |closure| ... } or close; repeated close is safe. Invocation belongs to the creating Ruby thread lifetime, not a reusable native thread ID. Closing during an active call defers disposal until that call finishes. Copying and serialization are rejected. Finalization provides fallback cleanup.

Finite copied values have a maximum depth of 128, 262144 visited nodes, a 16 MiB native-copy budget and a separate 16 MiB conversion-storage budget. These bounds do not cover Lean working memory or every Ruby allocator overhead. Cycles and uninhabited values reject. Input validation precedes native initialization; temporary buffers and callbacks clear on failure. Malformed native output retires the runtime. Native reentry is bounded to 64 active calls, with 4096 shared closure identities.

Integers remain exact. Nat rejects negative values, fixed-width integers reject overflow and native words are 64-bit. Numeric subclasses and coercions reject. String requires valid UTF-8 or US-ASCII and preserves NUL; ByteArray is a binary String. Char requires one Unicode scalar. Float32 rounds to binary32. Resources inside copied fields, nested callable identities and asynchronous operations remain outside this profile.
`
	};
	const entry = `lib/${model.requirePath}.rb`, internal = `lib/${model.requirePath}/native.rb`, shared = "lib/lean_bridge/native_copied_runtime_v1.rb";
	files["binding-manifest.json"] = JSON.stringify({ schemaVersion: 1
		, generator: "ruby-callable-graph-v1"
		, target: "ruby", component: ir.component.id
		, bindingIrSha256: hashBindingIr(ir), namespace: model.namespace
		, files: Object.keys(files)
		, publicFiles: [entry], internalFiles: [internal, shared], packageFiles: []
		, exports: ["LeanBridgeError", "LeanClosure", ...model.exports, ...model.functions.map(fn => fn.publicName)]
		, aliases: model.aliases
		, copiedGraph: { schemaVersion: 1, layoutSha256: model.layoutSha256 }
		, supportedFeatures: ["direct-functions", "copied-values", "recursive-values", "callbacks", "deterministic-close"]
		, capabilityGaps: [{ feature: "identity-and-effects", reason: "Copied fields cannot contain resource or callable identities; asynchronous operations remain unsupported." }
			, { feature: "additional-platforms", reason: "The native profile requires MRI Ruby 3.3 on Linux x86-64 with 1:1 threads." }] }, null, 2) + "\n";
	return Object.freeze(files);
};
