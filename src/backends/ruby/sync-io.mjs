/**
 * Generate ordinary Ruby methods over a compiler-authenticated synchronous wire.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { copiedRubyRuntime, rubyLiteral } from "./copied-assets.mjs";
import { isReservedRubyName } from "./copied-model.mjs";
import { verifiedRubyAssets } from "./verified-assets.mjs";

const bind = (name, params, result = "INT") => `::Fiddle::Function.new(LIBRARY[${rubyLiteral(name)}], [${params}], ::Fiddle::TYPE_${result})`;
const literal = v => v == null ? "nil" : rubyLiteral(v);
const reservedIO = ["DeclaredError", "IOError", "BoundaryError", "WrongContext", "Unavailable", "Ok", "Err", "NativeSyncWireV1", "NativeResourceLeaseV1", "ClosedResource"];
const reservedTasks = ["Task", "PullStream", "TaskRuntimeV1", "Cancelled", "Busy", "StepError", "TaskIOError", "DeliveryOwner", "RetainedRuntimeV1", "RetainedCallback", "CallbackClosed"];
const leaseBindings = (leases, ledger, ns) => !leases.length ? "" : `
      API = ::LeanBridge::${ns}
      LEASES = {${leases.map(r => `
        ${literal(r.type)} => { api: API, tag: ${r.tag}, name: ${literal(r.name)},
          class: NativeResourceLeaseV1.kind(${literal(ledger)}, ${literal(r.hash)}, API),
          close: ${bind(r.symbol + "_close", "P")}, retain: ${bind(r.symbol + "_retain", "P, P")}, same: ${bind(r.symbol + "_same", "P, P, P")} }.freeze`).join(",")}
      }.freeze
      LEASES.each_value { |ops| API.const_set(ops[:name], ops[:class]) }
      def self.drain_resources = NativeResourceLeaseV1.drain(API)
      def self.borrow_resource(type, value) = NativeResourceLeaseV1.borrow(LEASES.fetch(type), value)
      def self.take_resource(type, out, tag)
        ops = LEASES.fetch(type)
        raise BoundaryError, "Unexpected native lease kind" unless tag == ops[:tag]
        NativeResourceLeaseV1.atomic { NativeResourceLeaseV1.take(ops, out) }
      end`;
const callbacks = m => m.callbacks ? `
        callbacks: ${literal(m.callbacks)}, callback_fd: ${bind(m.names.callbacks, "P, P")},
        next_request: ${bind(m.names.next, "P, P")}, read_arg: ${bind(m.names.arg, "P, ::Fiddle::TYPE_INT, P")},
        reply: ${bind(m.names.reply, "P, ::Fiddle::TYPE_INT, P")}, fail: ${bind(m.names.fail, "P, P, P")},
        trap: ${bind(m.names.trap, "", "VOID")},` : "";
const asyncMethod = m => `      OPS${m.i} = {
        start: ${bind(m.names.start, "P, P, P, P")}, take: ${bind(m.names.take, "P, P, P")},
        poll: ${bind(m.names.poll, "P, P")}, close: ${bind(m.names.close, "P")},
        pull: ${m.names.pull ? bind(m.names.pull, "P") : "nil"},
        clear: CLEAR, open_wait: WAIT_OPEN, wake: WAIT_WAKE, end_wait: WAIT_CLOSE,
        decl: ${literal(m.declaration)}, step: ${literal(m.stepDeclaration)},
        args: ${literal(m.args)}, result: ${literal(m.result)}, error: ${literal(m.error)},
        terminal: ${literal(m.terminal)},${m.scoped ? " scoped: true," : ""}${callbacks(m)} depth: ${m.tagBytes}
      }.freeze
      def self.call${m.i}(${m.params})
        TaskRuntimeV1.start(OPS${m.i}, [${m.params}])
      end`;

/**
 * Produce a private loader and a public module with distinct IO and EIO exceptions.
 *
 * @param options - Validated gem coordinates, wire descriptors and library digests.
 */
export const generateRubySyncSources = async options => {
	const { name, wire, evidence } = options;
	const slug = name.replaceAll("-", "_"), ns = slug.split("_").map(s => s[0]?.toUpperCase() + s.slice(1)).join("");
	if(!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u.test(slug) || isReservedRubyName(ns)
		|| reservedIO.includes(ns))
		throw new TypeError("Invalid or reserved Ruby component namespace");
	if(wire.wait && reservedTasks.includes(ns))
		throw new TypeError("Reserved Ruby task namespace");
	const hosts = (wire.leases ?? []).filter(r => r.host), leases = (wire.leases ?? []).filter(r => !r.host);
	const provider = options.hostProvider;
	if(Boolean(provider) !== Boolean(hosts.length) || provider && provider.workerKinds?.length !== hosts.length
		|| hosts.some((r,i) => r.type !== "host:" + r.hash || !/^[a-f0-9]{64}$/u.test(r.hash) || r.tag !== i+3
			|| r.hash !== provider?.workerKinds?.[i]?.hash || r.name !== provider?.workerKinds?.[i]?.name) || (hosts.length && leases.length))
		throw new TypeError("Ruby worker wire does not match the MRI provider");
	if(leases.length && (!/^[a-f0-9]{64}$/u.test(options.ledgerId) || leases.some(r => !/^[A-Z][A-Za-z0-9_]*$/u.test(r.name)
		|| r.name === ns || isReservedRubyName(r.name) || reservedIO.includes(r.name) || reservedTasks.includes(r.name))))
		throw new TypeError("Invalid Ruby resource ledger or reserved resource class name");
	const path = "lean_bridge/" + slug, seen = new Set();
	const methods = wire.methods.map((m, i) => {
		const field = isReservedRubyName(m.name) ? m.name + "_" : m.name;
		if(seen.has(field)) throw new TypeError("Ruby export name collides: " + field);
		const names = m.args.map((_, n) => "v" + n), params = names.join(", "), last = names.at(-1);
		const trailing = m.callbacks && m.args.at(-1) === "callback";
		const signature = trailing ? [...names.slice(0, -1), last + " = nil", "&block"].join(", ") : params;
		const block = trailing ? `      raise ::ArgumentError, "Pass a callable or a block, not both" if block && !${last}.nil?
      ${last} = block if block
` : m.callbacks ? '      raise ::ArgumentError, "Pass callbacks in their declared positions" if block_given?\n' : "";
		if(provider && (provider.names.includes(field) || ["bind_hosts", "name","singleton_class"].includes(field) || field.startsWith("__"))) throw new TypeError("Ruby host and worker operations collide: " + field);
		const scoped = [m.args,m.result,m.error,m.terminal,m.callbacks].flat(Infinity).some(t => typeof t === "string" && t.startsWith("host:"));
		seen.add(field); return { ...m, scoped, field, i, params, signature, block };
	});
	const retained = methods.some(m => m.callbacks);
	const pub = `# frozen_string_literal: true
module LeanBridge
  module ${ns}
    ${provider ? "" : `UNIT = ::Object.new.freeze
    Ok = ::Data.define(:value)
    Err = ::Data.define(:value)`}
    class BoundaryError < ::StandardError; end
    class WrongContext < BoundaryError; end
    class Unavailable < BoundaryError; end${leases.length ? "\n    class ClosedResource < BoundaryError; end" : ""}
    ${provider ? "" : `class IOError < ::IOError
      attr_reader :declaration
      def initialize(declaration, message)
        @declaration = declaration
        super(message)
      end
    end
    class DeclaredError < ::StandardError
      attr_reader :declaration, :payload
      def initialize(declaration, payload)
        @declaration, @payload = declaration, payload
        super("Lean EIO failed in #{declaration}")
      end
    end`}
${methods.map(m => `    def self.${m.field}(${m.signature})
      raise WrongContext, "Lean calls require the main Ractor and main thread" unless ::Ractor.current.equal?(::Ractor.main) && ::Thread.current.equal?(::Thread.main)
${m.block}${leases.length ? "      Native.drain_resources\n" : ""}      Native.call${m.i}(${m.params})
    end`).join("\n")}
  end
end
require_relative "${slug}/native"
LeanBridge::${ns}.private_constant :Native
`;
	const native = `# frozen_string_literal: true
require "fiddle"
require "digest/sha2"
require_relative "sync_wire"${wire.wait ? '\nrequire_relative "task_runtime"' : ""}${retained ? '\nrequire_relative "retained_task"' : ""}${leases.length ? '\nrequire "lean_bridge/native_resource_lease_v1"' : ""}
module LeanBridge
  module ${ns}
    module Native
${verifiedRubyAssets(evidence)}
      P = ::Fiddle::TYPE_VOIDP${leaseBindings(leases, options.ledgerId, ns)}${provider ? `
      API = ::LeanBridge::${ns}
      HOSTS = {${hosts.map((h,i) => literal(h.type) + " => [" + i + ", " + h.tag + "].freeze").join(", ")}}.freeze
      def self.pin_host(type, value) = API.__send__(:__worker_pin, HOSTS.fetch(type)[0], value)
      def self.admit_host(type, token) = API.__send__(:__worker_admit, HOSTS.fetch(type)[0], token)
      def self.drop_host(type, token) = API.__send__(:__worker_drop, HOSTS.fetch(type)[0], token)
      def self.collect_hosts = API.__send__(:__worker_collect)
      def self.resolve_host(type, out, tag)
        index, expected = HOSTS.fetch(type)
        raise BoundaryError, "Unexpected Ruby worker class" unless tag == expected
        API.__send__(:__worker_resolve, index, out[0, 16])
      end` : ""}
      CLEAR = ::Fiddle::Function.new(LIBRARY[${rubyLiteral(wire.clear)}], [P], ::Fiddle::TYPE_VOID)${wire.wait ? `
      WAIT_OPEN = ${bind(wire.wait.open, "::Fiddle::TYPE_INT, ::Fiddle::TYPE_INT, P")}
      WAIT_WAKE = ${bind(wire.wait.wake, "P", "VOID")}
      WAIT_CLOSE = ${bind(wire.wait.close, "P", "VOID")}` : ""}
${methods.map(m => m.delivery ? asyncMethod(m) : `      CALL${m.i} = ::Fiddle::Function.new(LIBRARY[${rubyLiteral(m.symbol)}], [P, P, P], ::Fiddle::TYPE_INT)
      def self.call${m.i}(${m.params})
        if (reason = NativeCopiedRuntimeV1.context_error)
          raise WrongContext, reason
        end${wire.wait ? "\n        TaskRuntimeV1.drain" : ""}
        NativeSyncWireV1.call(::LeanBridge::${ns}, CALL${m.i}, CLEAR, ${rubyLiteral(m.declaration)}, ${rubyLiteral(m.args)}, ${rubyLiteral(m.result)}, ${m.error ? rubyLiteral(m.error) : "nil"}, ${rubyLiteral(m.effect)}, ${m.tagBytes}, [${m.params}])
      end`).join("\n")}
    end
  end
end
`;
	const helper = (await readFile(new URL("sync-wire.rb", import.meta.url), "utf8")).replace("LeanBridge::GeneratedSyncComponent", "LeanBridge::" + ns);
	const runtime = wire.wait && (await readFile(new URL("task-runtime.rb", import.meta.url), "utf8")).replaceAll("LeanBridge::GeneratedTaskComponent", "LeanBridge::" + ns);
	const retainedSource = retained && (await readFile(new URL("retained-task.rb", import.meta.url), "utf8")).replaceAll("LeanBridge::GeneratedTaskComponent", "LeanBridge::" + ns);
	return { namespace: "LeanBridge::" + ns, requirePath: path
		, files: { [`lib/${path}.rb`]: (provider?.ruby ?? "") + pub + (provider ? 'require_relative "' + slug + '/native/linux-x64/' + provider.extension + '"\n' + provider.privateMethods : "")
			, [`lib/${path}/native.rb`]: native
			, "lib/lean_bridge/native_copied_runtime_v1.rb": copiedRubyRuntime
			, ...leases.length ? { "lib/lean_bridge/native_resource_lease_v1.rb": await readFile(new URL("resource-lease.rb", import.meta.url), "utf8") } : {}
			, [`lib/${path}/sync_wire.rb`]: helper
			, ...runtime ? { [`lib/${path}/task_runtime.rb`]: runtime } : {}
			, ...retainedSource ? { [`lib/${path}/retained_task.rb`]: retainedSource } : {} } };
};
