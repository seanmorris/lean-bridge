/**
 * Generate the main-thread C++ projection of a checked, callback-taking Lean task.
 *
 * @file
 */

/**
 * Store the C++ exception itself. Only the native ID of the original Lean IO.Error selects it.
 *
 * @param p - Native component symbol prefix.
 */
export const cppCallbackFaults = p => `
struct CallbackFaults {
    std::vector<std::exception_ptr> errors;
    template<class H, class F> void save(H handle, F fail, std::exception_ptr error, const char *what) {
        if (errors.size() >= 4096) throw std::length_error("too many retained callback exceptions");
        errors.push_back(std::move(error)); std::uint32_t id = 0;
        std::size_t len = 0; if (what) while (len < 4096 && what[len]) ++len;
        auto s = fail(handle, {reinterpret_cast<const std::uint8_t *>(what), len}, &id);
        if (s == ${p}_INVALID) {
            static constexpr char fallback[] = "C++ callback exception";
            s = fail(handle, {reinterpret_cast<const std::uint8_t *>(fallback), sizeof(fallback) - 1}, &id);
        }
        check(s);
        if (id != errors.size()) throw std::logic_error("unexpected Lean callback exception identity");
    }
    [[noreturn]] void raise(std::uint32_t id) const {
        if (!id || id > errors.size()) throw std::logic_error("unknown Lean callback exception identity");
        std::rethrow_exception(errors[id-1]);
    }
};
`;

/**
 * Render an ordinary closure-taking entry, its typed replies, and its exactly-once take.
 *
 * @param options - Checked declaration, symbols, codecs and ownership helpers.
 */
export const cppRetainedEntry = options => {
	const { e, name, c, p, codec, slot, guards } = options;
	if(e.delivery !== "task") throw new TypeError("Retained C++ callbacks require a compiled Task");
	const ps = e.parameters.map(({ type }, j) => type.kind === "io-callback"
		? { j, input: codec(type.argument), reply: codec(type.reply), noArg: type.argument.name === "unit", noReply: type.reply.name === "unit" }
		: { j, c: codec(type) });
	const callbacks = ps.filter(x => x.input), args = ps.filter(x => x.c), item = codec(e.result);
	const err = e.effect === "EIO" && codec(e.error), result = e.result.name === "unit" ? "void" : item.type;
	const decl = JSON.stringify(e.declaration), bigint = [item, err, ...ps.flatMap(x => x.c ? [x.c] : [x.input, x.reply])].some(v => v?.bigint);
	const params = ps.map(x => x.c ? x.c.arg + " v" + x.j : `RetainedCallback<${x.noReply ? "void" : x.reply.type}(${x.noArg ? "" : x.input.type})> v${x.j}`);
	const cases = callbacks.map(({ j, input, reply, noArg, noReply }) => `case ${j}: {
                ${slot(c + "_callback_arg_" + j, "in", input)}
                detail::check(${c}_arg_${j}(owner->handle, &in.value));
                ${noArg ? "" : "auto arg = " + input.read("in.value") + ";"} ${noReply ? "" : "std::optional<" + reply.type + "> result;"}
                try { ${noReply ? "v" + j + "(" + (noArg ? "" : "std::move(arg)") + ");" : "result.emplace(v" + j + "(" + (noArg ? "" : "std::move(arg)") + "));"} }
                catch (const std::exception &ex) {
                    if (!owner->handle.id) return;
                    faults->save(owner->handle, &${c}_fail, std::current_exception(), ex.what()); break;
                }
                catch (...) { (void)${p}_callback_trap(); throw CallbackTrap{${decl}}; }
                if (!owner->handle.id) return;
                ${noReply ? "" : "auto &v = *result;"} ${reply.direct ? `std::size_t available = 16u * 1024u * 1024u; detail::IntegerIn arg_v(v, detail::count(v, ${reply.natural}, available));` : ""}
                detail::check(${c}_reply_${j}(owner->handle, ${noReply ? "0" : reply.input("v")})); break;
            }`);
	const source = `inline Future<${result}> ${name}(${params.join(", ")}) {
    auto &loop = async_v2::detail::Loop::main(); loop.enter();
    ${guards(ps.map(x => x.c))}auto owner = std::make_shared<detail::Owner<${c}_handle, ${c}_close>>();
    auto faults = std::make_shared<detail::CallbackFaults>();
    detail::check(${c}_start(${[...args.map(x => x.c.input("v" + x.j)), "&owner->handle"].join(", ")}));
    int fd = -1; detail::check(${c}_callbacks(owner->handle, &fd));
    return async_v2::detail::future<${result}>(loop,
        [owner] { int completion = -1; auto s = ${c}_poll(owner->handle, &completion); if (s != ${p}_PENDING) detail::check(s); return completion; },
        [owner, faults] {
            ${slot(c + "_value", "out", item)} ${err ? slot(c + "_start_error", "err", err) : ""}
            detail::Slot<${p}_buffer> message{&${p}_buffer_dispose}; std::uint32_t origin = 0; std::uint8_t phase = 0;
            auto s = ${c}_take(&owner->handle, &out.value${err ? ", &err.value" : ""}, &message.value, &origin, &phase);
            ${err ? `if (s == ${p}_TYPED_ERROR) throw StartError<${err.type}>{${decl}, ${err.read("err.value")}};` : ""}
            if (s == ${p}_IO_ERROR) {
                if (origin) faults->raise(origin);
                if (phase == 2) throw IOError{${decl}, detail::text(message.value)};
                if (phase == 3) throw TaskIOError{${decl}, detail::text(message.value)};
                throw std::logic_error("unknown Lean callback error phase");
            }
            detail::check(s); return ${item.read("out.value")};
        }, [owner] { owner->close(); }, fd,
        [owner, faults, ${callbacks.map(x => `v${x.j} = std::move(v${x.j})`).join(", ")}] {
            for (unsigned n = 0; n < 16 && owner->handle.id; ++n) {
                std::uint32_t which = 0; auto s = ${c}_next(owner->handle, &which);
                if (s == ${p}_PENDING) return;
                detail::check(s); switch (which) {
                ${cases.join("\n                ")}
                default: throw std::logic_error("unknown Lean callback slot");
                }
            }
        });
}`;
	return { bigint, source };
};
