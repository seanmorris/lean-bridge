/**
 * Generate ordinary Ruby functions and private copied-value native calls.
 *
 * @file
 */
import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { compileCopiedRubyModel } from "./copied-model.mjs";
import { copiedRubyAssets } from "./copied-assets.mjs";
import { copiedRubyConversions, copiedRubyHelpers, readRubyValue } from "./copied-conversions.mjs";
import { rubyValue, rubyClosurePublic, rubyNativeCall, rubyCallableTypes, rubyCallableSupport } from "./callables.mjs";

const args = fn => fn.declaration.parameters.map((_, index) => `arg${index}`);
const publicSource = model => `# frozen_string_literal: true
module LeanBridge
  module ${model.componentName}
    UNIT = ::Object.new.freeze
    class LeanBridgeError < ::StandardError; end
${model.surface.copies.some(copy => copy.compound === "option") ? "    Some = ::Data.define(:value)\n" : ""}\
${model.surface.copies.some(copy => copy.compound === "result") ? "    Ok = ::Data.define(:value)\n    Err = ::Data.define(:value)\n" : ""}\
${model.surface.callbacks.size ? rubyClosurePublic : ""}\
${model.surface.copies.filter(copy => copy.record).map(copy => `    class ${copy.publicName}
      ${copy.fields.length ? `attr_reader ${copy.fields.map(field => `:${field.name}`).join(", ")}` : ""}
      def initialize(${copy.fields.map(field => `${field.name}:`).join(", ")})
${copy.fields.map(field => `        @${field.name} = ${field.name}`).join("\n")}
        freeze
      end
    end`).join("\n")}
    module_function
${model.surface.functions.map((fn, index) => {
	const parameters = args(fn), last = parameters.at(-1);
	const block = fn.declaration.parameters.length && model.surface.callbacks.has(fn.declaration.parameters.at(-1).type.id);
	return `    def ${fn.field}(${(block ? [...parameters.slice(0, -1), `${last} = nil`, "&block"] : parameters).join(", ")})
      ${block ? `raise ArgumentError, "Pass a callable or a block, not both" if !${last}.nil? && block\n      ${last} = block if ${last}.nil?` : ""}
      Native.call${index}(${parameters.join(", ")})
    end`;
}).join("\n")}
  end
end
require_relative "${model.surface.prefix}/native"
LeanBridge::${model.componentName}.private_constant :Native
`;
const nativeSource = (model, evidence) => `# frozen_string_literal: true
require "fiddle"
require "digest"
require "digest/sha2"
${model.surface.callbacks.size ? 'require "monitor"\nraise LoadError, "Lean callables require Ruby 1:1 threads; unset RUBY_MN_THREADS" unless ENV.fetch("RUBY_MN_THREADS", "0").to_i.zero?\n' : ""}\
module LeanBridge
  module ${model.componentName}
    module Native
      extend self
${copiedRubyAssets(model, evidence)}
${model.surface.functions.map((fn, index) => `      CALL${index} = ::Fiddle::Function.new(LIBRARY["${fn.name}"], [${fn.declaration.parameters.map(site => `::Fiddle::TYPE_${rubyValue(model, site.type).ffi}`).concat(fn.resultType === "void" ? [] : ["::Fiddle::TYPE_VOIDP"]).concat("::Fiddle::TYPE_VOIDP").join(", ")}], ::Fiddle::TYPE_INT${model.surface.callbacks.size ? ", need_gvl: true" : ""})`).join("\n")}
${rubyCallableTypes(model)}
${model.surface.copies.filter(copy => copy.aggregate).map(copy => `      CLEAR${copy.index} = ::Fiddle::Function.new(LIBRARY["${copy.name}_clear"], [::Fiddle::TYPE_VOIDP], ::Fiddle::TYPE_VOID)`).join("\n")}
${copiedRubyHelpers}
${copiedRubyConversions(model)}
${model.surface.callbacks.size ? rubyCallableSupport(model) : ""}
${model.surface.functions.map((fn, index) => {
	if(model.surface.callbacks.size) return rubyNativeCall(model, { ...fn.declaration, name: `call${index}`, symbol: `CALL${index}` });
	const copy = model.surface.copy(fn.declaration.result.type), unit = fn.resultType === "void";
	return `      def call${index}(${args(fn).join(", ")})
        ::Thread.handle_interrupt(Exception => :never) do
          scope = Scope.new
          begin
${fn.declaration.parameters.map((site, n) => `            input${n} = to${model.surface.copy(site.type).index}(arg${n}${model.surface.copy(site.type).aggregate ? ", scope" : ""})`).join("\n")}
            ${unit ? "" : `output = scope.allocate(${copy.size})`}
            error = scope.allocate(24)
            begin
              check(CALL${index}.call(${args(fn).map((_, n) => `input${n}`).concat(unit ? [] : ["output"]).concat("error").join(", ")}), error)
              ${unit ? "UNIT" : `from${copy.index}(${readRubyValue(copy, "output")})`}
            ensure
              ${copy.aggregate ? `CLEAR${copy.index}.call(output)` : ""}
            end
          ensure
            scope.close
          end
        end
      end`;
}).join("\n")}
    end
  end
end
`;

/**
 * Render public Ruby values and private scoped native calls.
 *
 * @param model - Admitted Ruby model.
 * @param evidence - Optional compiled library evidence.
 */
export const renderCopiedRubyPackage = (model, evidence = null) => {
	const entry = `lib/${model.requirePath}.rb`, internal = `lib/${model.requirePath}/native.rb`;
	const shared = "lib/lean_bridge/native_copied_runtime_v1.rb";
	const files = { [entry]: publicSource(model)
		, [internal]: nativeSource(model, evidence)
		, [shared]: '# frozen_string_literal: true\nmodule LeanBridge\n  module NativeCopiedRuntimeV1\n    LOCK = ::Mutex.new\n    STATE = { components: {}, handles: [] }\n  end\n  private_constant :NativeCopiedRuntimeV1\nend\n'
		, "README.md": `# ${model.namespace}\n\nRequire "${model.requirePath}" and call ${model.namespace} functions. Prepared gems include the native component and shared runtime, which load automatically. Requires MRI Ruby 3.3 on Linux x86-64. No Lean compiler or extension build is needed by consumers.\n\nUnit is ${model.namespace}::UNIT in every position. Integers remain exact; fixed-width values are range checked and Nat rejects negatives. Float32 rounds to binary32. Strings require valid UTF-8 or US-ASCII, including embedded NUL; ByteArray uses binary String. Arrays and generated keyword-initialized record values are copied at each call. Nil is rejected outside Option positions; implicit numeric coercions are rejected. Copied types must be pure, acyclic and at most 32 levels deep. Native input/output copies share a 16 MiB budget; input scratch is separately bounded. Native buffers are freed on failure. Compatible gems share one runtime for the process lifetime. Ractors and native-library unloading are not supported.\n\n${model.surface.functions.map(fn => `- ${model.namespace}.${fn.field}: ${fn.declaration.id}`).join("\n")}\n` };
	if(model.surface.callbacks.size) files["README.md"] += "\nSynchronous primitive callbacks accept callable objects or a final Ruby block. Borrowed callbacks expire when the exporting call returns. Returned LeanClosure values support call, close, closed?, and with { |closure| ... } for scoped cleanup. Invoke them on their creating thread. Exceptions are re-raised after native cleanup; non-local block exits raise LocalJumpError. Re-entry is limited to 64 native calls. Closures cannot be copied or serialized. Forked children, Ractors and RUBY_MN_THREADS are unsupported.\n";
	if(model.surface.copies.some(copy => copy.compound === "option")) files["README.md"] += "\nOptions use nil or Some.new(value). Some.new(nil) is an outer Some containing an inner None; Some.new(UNIT) retains presence for Unit. Nil is admitted only at Option positions.\n";
	if(model.surface.copies.some(copy => copy.compound === "result")) files["README.md"] += "\nResults use Ok.new(value) or Err.new(error). Domain errors return Err; bridge failures raise.\n";
	if(model.surface.copies.some(copy => ["option", "result"].includes(copy.compound))) files["README.md"] += "\nBranch wrappers are frozen Data classes with value equality and pattern matching. Wrapper fields are frozen, but nested strings and arrays remain mutable.\n";
	if(model.surface.copies.some(copy => copy.compound === "tuple")) files["README.md"] += "\nProducts use exactly two Array elements and preserve nesting.\n";
	if(model.surface.copies.some(copy => copy.compound)) files["README.md"] += "\nPayloads are checked against the concrete Lean type when called; no implicit coercion is used. Returned values own independent storage.\n";
	files["binding-manifest.json"] = `${JSON.stringify({ schemaVersion: 1, generator: "ruby-copied-v1", target: "ruby", component: model.ir.component.id, bindingIrSha256: hashBindingIr(model.ir), namespace: model.namespace, files: Object.keys(files), publicFiles: [entry], internalFiles: [internal, shared], packageFiles: [], supportedFeatures: ["direct-functions", "copied-values", "deterministic-close", ...model.surface.callbacks.size ? ["primitive-callbacks", "returned-closures"] : []], capabilityGaps: [{ feature: "identity-and-effects", reason: "Ordinary RubyGems admits copied values and synchronous primitive callables; resource identities, compound callables and async effects remain unsupported." }, { feature: "additional-platforms", reason: "The compiled profile is MRI Ruby 3.3 on Linux x86-64." }] }, null, 2)}\n`;
	return Object.freeze(files);
};

/**
 * Generate copied Ruby bindings from their canonical semantic model.
 *
 * @param ir - Authoritative Binding IR.
 * @param evidence - Optional compiled native evidence.
 */
export const generateCopiedRubyPackage = (ir, evidence = null) => renderCopiedRubyPackage(compileCopiedRubyModel(ir), evidence);
