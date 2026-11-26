/**
 * Project authenticated C calls into C++20 values, exceptions and, for real tasks, coroutines.
 *
 * @file
 */
import { taskResourceTypes } from "../c/task-resources.mjs";
import { cppCallbackFaults, cppRetainedEntry } from "./task-callback.mjs";
const reserved = new Set(("alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public reflexpr register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch synchronized template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq detail run_one shutdown").split(" "));
const scalars = {
	unit: "std::monostate", char: "char32_t", bool: "bool"
	, float32: "float", float64: "double"
	, usize: "std::size_t", isize: "std::intptr_t"
	, string: "std::string", bytes: "std::vector<std::uint8_t>"
};
for(const sign of ["int", "uint"])
	for(const bits of [8, 16, 32, 64]) scalars[`${sign}${bits}`] = `std::${sign}${bits}_t`;
const codec = (t, resources, leaseAccess) => {
	if(t?.kind === "named" && resources.some(r => r.id === t.id))
	{
		const r = resources.find(r => r.id === t.id);
		return { type: r.name
			, arg: "const " + r.name + "&"
			, owned: true
			, resource: true
			, read: v => `${leaseAccess}::adopt(${v}, detail::ops_${r.slug})`
			, input: v => `${leaseAccess}::view(${v})` };
	}
	if(t?.kind === "primitive" && ["nat", "int"].includes(t.name))
	{
		const natural = t.name === "nat", type = natural ? "Nat" : "Int";
		return { type, arg: `const ${type}&`, owned: true
			, bigint: true, direct: true, natural
			, read: v => `detail::integer(${v})`, input: v => `arg_${v}.view()` };
	}
	if(t?.kind === "primitive" && Object.hasOwn(scalars, t.name))
	{
		const type = scalars[t.name], buffer = ["string", "bytes"].includes(t.name);
		const arg = t.name === "string" ? "std::string_view" : t.name === "bytes" ? "std::span<const std::uint8_t>" : type;
		return { type, arg, owned: buffer, buffer
			, input: v => buffer ? `{reinterpret_cast<const std::uint8_t *>(${v}.data()), ${v}.size()}` : t.name === "unit" ? `(static_cast<void>(${v}), 0)` : v
			, read: v => buffer ? `detail::${t.name === "string" ? "text" : "bytes"}(${v})` : t.name === "unit" ? "std::monostate{}" : `static_cast<${type}>(${v})` };
	}
	if(t?.kind !== "apply" || t.constructor !== "result" || t.arguments?.length !== 2) throw new TypeError("Unsupported C++ task carrier");
	const [ok, err] = t.arguments.map(v => codec(v, resources, leaseAccess)), type = `Result<${ok.type}, ${err.type}>`;
	if(ok.resource || err.resource) throw new TypeError("Resource-bearing sums require an owned aggregate contract");
	return { type, owned: ok.owned || err.owned, bigint: ok.bigint || err.bigint, read: v => `(${v}.ok ? ${type}{Ok<${ok.type}>{${ok.read(v + ".as.value")}}} : ${type}{Err<${err.type}>{${err.read(v + ".as.error")}}})` };
};
const slot = (site, local, t) => `detail::Slot<${site}> ${local}{${t.owned ? "&" + site + "_dispose" : ""}};`;
const inputGuards = args => args.some(a => a?.direct) ? [
	"std::size_t available = 16u * 1024u * 1024u;"
	, ...args.flatMap((a, i) => a?.direct ? [`const auto limbs${i} = detail::count(v${i}, ${a.natural}, available);`] : a?.buffer ? [`detail::charge(available, v${i}.size());`] : [])
	, ...args.flatMap((a, i) => a?.direct ? [`detail::IntegerIn arg_v${i}(v${i}, limbs${i});`] : [])
].join("\n    ") + "\n    " : "";

/**
 * Keep the C handles, ownership operations, buffers and effect tags out of application code.
 *
 * @param options - Declaration list and the prefix of the exact compiled C adapter.
 */
export const generateCppTaskHeader = options => {
	const { prefix: p, entries } = options, names = new Set();
	const resources = taskResourceTypes(options.resources);
	const synchronous = options.synchronousIO === true;
	const cursors = entries.some(e => e.delivery === "iterator");
	if(cursors && !synchronous || synchronous && (entries.some(e => (e.delivery && e.delivery !== "iterator") || e.taskIO) || !(cursors || entries.some(e => ["IO", "EIO", "BaseIO"].includes(e.effect)))))
		throw new TypeError("Invalid standalone C++ IO delivery contract");
	for(const r of resources)
		if(reserved.has(r.name) || r.name.startsWith("_") || r.name.includes("__")
			|| (synchronous && r.name === "DeclaredError") || (cursors && r.name === "Cursor")
			|| "Int Nat Future Stream Routine Ok Err Result StartError StepError IOError TaskIOError RetainedCallback CallbackTrap CallbackClosed Cancelled Closed Busy Unavailable WrongContext".split(" ").includes(r.name))
			throw new TypeError("Reserved C++ resource class name");
		else names.add(r.name);
	const value = t => codec(t, resources, synchronous ? "sync_v1::detail::LeaseAccess" : "async_v2::detail::LeaseAccess");
	let bigint = false, retained = false;
	const functions = entries.map(e => {
		const name = reserved.has(e.name) ? e.name + "_" : e.name;
		if(!/^[a-z][a-z0-9_]*$/u.test(name) || name.includes("__") || names.has(name)) throw new TypeError("Invalid or colliding C++ task name");
		names.add(name);
		const c = `${p}_${e.name}`, stream = e.delivery === "async-iterator", async = stream || e.delivery === "task", direct = e.delivery === "iterator";
		if(e.delivery && !async && !direct) throw new TypeError("Unsupported C++ delivery protocol");
		if(e.taskIO && e.delivery !== "task") throw new TypeError("Terminal IO errors require a real Task");
		if(e.parameters.some(a => a.type.kind === "io-callback"))
		{
			const result = cppRetainedEntry({ e, name, c, p, codec: value, slot, guards: inputGuards, once: options.onceByDeclaration?.has(e.declaration) });
			retained = true; bigint ||= result.bigint; return result.source;
		}
		const args = e.parameters.map(v => value(v.type)), item = value(e.result);
		if(args.some(a => !a.arg)) throw new TypeError("C++ task arguments must be copied scalars");
		const unit = e.result.kind === "primitive" && e.result.name === "unit", type = unit ? "void" : item.type;
		const out = stream ? `Stream<${item.type}>` : async ? `Future<${type}>` : type;
		const er = e.effect === "EIO" ? value(e.error) : null, step = e.stepError ? value(e.stepError) : null, io = e.effect === "IO";
		bigint ||= [item, er, step, ...args].some(t => t?.bigint);
		const guards = inputGuards(args);
		const startArgs = [...args.map((a, i) => a.input(`v${i}`)), direct ? "handle" : async ? "&owner->handle" : "&value.value"];
		if(er || io) startArgs.push("&error.value");
		const startError = er ? slot(c + (synchronous ? "_error" : "_start_error"), "error", er) : io ? `detail::Slot<${p}_buffer> error{&${p}_buffer_dispose};` : "";
		const catchStart = er ? `if (s == ${p}_TYPED_ERROR) throw ${synchronous ? "DeclaredError" : "StartError"}<${er.type}>{"${e.declaration}", ${er.read("error.value")}};`
			: io ? `if (s == ${p}_IO_ERROR) throw IOError{"${e.declaration}", detail::text(error.value)};` : "";
		const read = slot(c + "_value", "value", item);
		if(direct)
		{
			return `inline Cursor<${item.type}> ${name}(${args.map((a, i) => `${a.arg} v${i}`).join(", ")}) {
    ${resources.length ? "sync_v1::detail::enter_leases();" : ""}
    return sync_v1::detail::make_cursor<${item.type}, WrongContext, ${c}_handle, ${c}_close>(
        [&](auto *handle) {
            ${guards}${startError}
            auto s = ${c}_open(${startArgs.join(", ")}); ${catchStart}
            detail::check(s);
        }, [](auto *handle) -> std::optional<${item.type}> {
            ${read} ${step ? slot(c + "_step_error", "error", step) : ""}
            ${e.stepIO ? `detail::Slot<${p}_buffer> msg{&${p}_buffer_dispose};` : ""}
            auto s = ${c}_next(handle, &value.value${step ? ", &error.value" : ""}${e.stepIO ? ", &msg.value" : ""});
            if (s == ${p}_END) return {};
            ${step ? `if (s == ${p}_TYPED_ERROR) throw DeclaredError<${step.type}>{"${e.protocol.next}", ${step.read("error.value")}};` : ""}
            ${e.stepIO ? `if (s == ${p}_IO_ERROR) throw IOError{"${e.protocol.next}", detail::text(msg.value)};` : ""}
            detail::check(s); return std::optional<${item.type}>{${item.read("value.value")}};
        });
}`;
		}
		const take = `[owner] {
        ${read} ${step ? slot(c + "_step_error", "error", step) : ""}
        ${e.taskIO ? `detail::Slot<${p}_buffer> terminal{&${p}_buffer_dispose};` : ""}
        auto s = ${c}_take(&owner->handle, &value.value${step ? ", &error.value" : ""}${e.taskIO ? ", &terminal.value" : ""});
        ${e.taskIO ? `if (s == ${p}_IO_ERROR) throw TaskIOError{"${e.declaration}", detail::text(terminal.value)};` : ""}
        ${stream ? `if (s == ${p}_END) return std::optional<${item.type}>{};` : ""}
        ${step ? `if (s == ${p}_TYPED_ERROR) throw StepError<${step.type}>{"${e.declaration}", ${step.read("error.value")}};` : ""}
        detail::check(s); return ${stream ? `std::optional<${item.type}>{${item.read("value.value")}}` : item.read("value.value")};
    }`;
		const poll = `[owner] { int fd = -1; auto s = ${c}_poll(owner->handle, &fd);
        if (s != ${p}_PENDING) detail::check(s);
        return fd; }`;
		const close = "[owner] { owner->close(); }";
		const finish = stream ? `return ${out}(std::make_shared<async_v2::detail::Cursor<${item.type}>>(loop,
        [owner] { detail::check(${c}_pull(owner->handle)); }, ${poll}, ${take}, ${close}));`
			: async ? `return async_v2::detail::future<${type}>(loop, ${poll}, ${take}, ${close});`
			: unit ? "return;" : `return ${item.read("value.value")};`;
		return `inline ${out} ${name}(${args.map((a, i) => `${a.arg} v${i}`).join(", ")}) {
    ${synchronous ? resources.length ? "sync_v1::detail::enter_leases();" : "" : "auto &loop = async_v2::detail::Loop::main(); loop.enter();"}
    ${cursors ? "sync_v1::detail::enter_cursors<WrongContext>(); " : ""}${guards}${async ? `auto owner = std::make_shared<detail::Owner<${c}_handle, ${c}_close>>();` : read}
    ${startError}
    auto s = ${c}_${async ? "start" : "call"}(${startArgs.join(", ")}); ${catchStart}
    detail::check(s); ${finish}
}`;
	});
	const guard = p.toUpperCase() + (synchronous ? "_CPP_IO_V1_HPP" : "_CPP_TASK_V2_HPP"), lifecycle = resources.length ? "async_v2" : "sync_v1";
	return `#ifndef ${guard}
#define ${guard}
#include "${p}.h"
#include <lean_bridge/${synchronous ? "sync_v1/sync-values.hpp" : "async_v2/task-routine.hpp"}>${cursors ? "\n#include <lean_bridge/sync_v1/sync-iterator.hpp>" : ""}
#include <span>${retained ? "\n#include <lean_bridge/async_v2/task-callback.hpp>" : ""}${resources.length ? `\n#include <lean_bridge/${synchronous ? "sync_v1/sync-resource.hpp" : "async_v2/task-resource.hpp"}>` : ""}${bigint ? `
#ifndef BOOST_MP_STANDALONE
#define BOOST_MP_STANDALONE
#endif
#include <boost/multiprecision/cpp_int.hpp>
#include <bit>
#include <iterator>
#include <limits>` : ""}
namespace lean_bridge::${p} {
${resources.map(r => `using ${r.name} = async_v2::Resource<${r.raw}>;\n`).join("")}${bigint ? "using Nat = boost::multiprecision::cpp_int; using Int = boost::multiprecision::cpp_int;\n" : ""}${synchronous ? `using sync_v1::Ok; using sync_v1::Err; using sync_v1::Result; using sync_v1::IOError; using sync_v1::DeclaredError;
using ${lifecycle}::Closed; using ${lifecycle}::Busy; using ${lifecycle}::WrongContext; using ${lifecycle}::Unavailable;` : `using async_v2::Future; using async_v2::Stream; using async_v2::Routine;
using async_v2::Ok; using async_v2::Err; using async_v2::Result;
using async_v2::StartError; using async_v2::StepError; using async_v2::IOError;
using async_v2::TaskIOError;${retained ? "\nusing async_v2::RetainedCallback; using async_v2::CallbackTrap; using async_v2::CallbackClosed;" : ""}
${options.onceByDeclaration?.size?'struct CallbackAlreadyInvoked : std::runtime_error { CallbackAlreadyInvoked() : std::runtime_error("callback-already-invoked") {} };\n':""}using async_v2::Cancelled; using async_v2::Closed; using async_v2::Busy;
using async_v2::Unavailable; using async_v2::WrongContext; using async_v2::run_one; using async_v2::shutdown;`}
${cursors ? "template<class T> using Cursor = sync_v1::Cursor<T, WrongContext>;\n" : ""}namespace detail {${bigint ? `
inline void charge(std::size_t &available, std::size_t bytes) {
    if (bytes > available) throw std::length_error("Lean copy budget exceeded");
    available -= bytes;
}
inline std::size_t count(const Int &v, bool natural, std::size_t &available) {
    if (natural && v < 0) throw std::invalid_argument("Nat must be nonnegative");
    if (!v) return 0;
    const auto &b = v.backend(); const auto n = b.size();
    using Limb = std::remove_cvref_t<decltype(*b.limbs())>;
    static_assert(sizeof(Limb) == 4 || sizeof(Limb) == 8);
    if (n - 1 > available / sizeof(Limb)) throw std::length_error("Lean copy budget exceeded");
    auto bits = (static_cast<std::size_t>(n) - 1) * std::numeric_limits<Limb>::digits + std::bit_width(b.limbs()[n - 1]);
    auto count = (bits + 63) / 64; charge(available, count * 8); return count;
}
struct IntegerIn {
    std::vector<std::uint64_t> words; bool negative;
    IntegerIn(const Int &v, std::size_t n) : negative(v < 0) {
        words.reserve(n);
        if (n) boost::multiprecision::export_bits(v, std::back_inserter(words), 64, false);
    }
    ${p}_integer_view view() const { return {words.data(), words.size(), negative}; }
};
inline Int integer(const ${p}_integer &v) {
    Int result = 0;
    if (v.len) boost::multiprecision::import_bits(result, v.words, v.words + v.len, 64, false);
    if (v.negative) result = -result;
    return result;
}` : ""}
template<class R> struct Slot {
    void (*dispose)(R*){}; R value{};
    explicit Slot(void (*d)(R*) = nullptr) noexcept : dispose(d) {}
    Slot(const Slot&) = delete;
    ~Slot() { if (dispose) dispose(&value); }
};
${synchronous ? "" : `template<class H, auto Drop> struct Owner {
    H handle{}; Owner() = default; Owner(const Owner&) = delete;
    void close() noexcept { if (handle.id) (void)Drop(&handle); }
    ~Owner() { close(); }
};`}
inline std::string text(const ${p}_buffer &b) {
    return b.len ? std::string(reinterpret_cast<const char *>(b.data), b.len) : std::string{};
}
inline std::vector<std::uint8_t> bytes(const ${p}_buffer &b) {
    return b.len ? std::vector<std::uint8_t>(b.data, b.data + b.len) : std::vector<std::uint8_t>{};
}
inline void check(${p}_status s) {
    switch (s) {
    case ${p}_OK: return;
    case ${p}_CLOSED: throw Closed{};
    case ${p}_BUSY: throw Busy{};
    case ${p}_WRONG_CONTEXT: throw WrongContext{};
    case ${p}_UNAVAILABLE: throw Unavailable{};
    case ${p}_NO_MEMORY: throw std::bad_alloc{};
    case ${p}_LIMIT: throw std::length_error("Lean copy budget exceeded");
    case ${p}_INVALID: throw std::invalid_argument("invalid Lean argument");
    default: throw std::runtime_error("unexpected Lean ${synchronous ? "call" : "task"} state: " + std::to_string(s));
    }
}
${retained ? cppCallbackFaults(p) : ""}${resources.map(r => {
		const b = `${p}_resource_${r.slug}`, t = r.raw;
		return `inline constexpr async_v2::detail::LeaseOps<${t}> ops_${r.slug}{
    [](${t} *v) noexcept { (void)${b}_release(v); },
    [](${t} v, ${t} *o) { check(${b}_retain(v, o)); },
    [](${t} a, ${t} b) { bool v = false; check(${b}_same(a, b, &v)); return v; }
};\n`;
}).join("")}} // namespace detail
${functions.join("\n")}
} // namespace lean_bridge::${p}
#endif
`;
};
