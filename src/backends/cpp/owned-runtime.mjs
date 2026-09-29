/**
 * C++ ownership controls over the checked C session/result API.
 * Destructors never invoke thread-bound native cleanup on a foreign thread.
 *
 * @file
 */
import { ownedCppTransferSignal } from "./owned-transfers.mjs";

/**
 * Emit private RAII leases, owner-thread deferred cleanup and nominal resources.
 * This support layer does not itself admit exports or prepared C++ packages.
 *
 * @param prefix - Validated public C package identifier.
 * @param options - Explicit input-consumption support for this projection.
 * @param options.transferredInputs - Watch the C handoff before callback reentry.
 */
export const ownedCppRuntime = (prefix, { transferredInputs = false } = {}) => {
	if(!/^[a-z][a-z0-9_]*$/u.test(prefix) || prefix.includes("__")) throw new TypeError("Invalid owned C++ prefix");
	const p = prefix, m = prefix.toUpperCase();
	return `
class Error final : public std::runtime_error {
public:
  ${p}_status status;
  explicit Error(${p}_status value) : std::runtime_error("Lean ownership boundary rejected the operation"), status(value) {}
};
namespace detail {
inline void checked(${p}_status value) { if (value != ${m}_OK) throw Error(value); }
struct NativeOwner {
  ${p}_result *value = nullptr;
  NativeOwner() = default;
  NativeOwner(const NativeOwner&) = delete;
  NativeOwner& operator=(const NativeOwner&) = delete;
  ~NativeOwner() { if (value) (void)${p}_result_release(&value); }
};
${transferredInputs ? ownedCppTransferSignal(p) + "\n" : ""}struct Slot {
  std::atomic<${p}_result *> owner{nullptr};
  bool pending = false;
};
struct BorrowScope { std::atomic<bool> active{true}; };
class State;
class Lease {
  std::shared_ptr<State> state_;
  std::shared_ptr<Slot> slot_;
  std::shared_ptr<BorrowScope> borrow_;
  ${transferredInputs ? "std::atomic<std::shared_ptr<InputMoveSignal>> transfer_;\n  std::atomic<bool> transferred_{false};\n  " : ""}friend class State;
  Lease(std::shared_ptr<State> state, std::shared_ptr<Slot> slot) noexcept
    : state_(std::move(state)), slot_(std::move(slot)) {}
  Lease(std::shared_ptr<State> state, std::shared_ptr<BorrowScope> borrow) noexcept
    : state_(std::move(state)), borrow_(std::move(borrow)) {}
public:
  Lease(const Lease&) = delete;
  Lease& operator=(const Lease&) = delete;
  ~Lease();
  const std::shared_ptr<State>& state() const noexcept { return state_; }
  void require() const;
  bool closed() const noexcept;${transferredInputs ? `
  bool transferred() const noexcept {
    if (transferred_.load()) return true;
    const auto pending = transfer_.load(); return pending && pending->consumed();
  }
  void require_transfer() const {
    require();
    if (!slot_ || transfer_.load()) throw Error(${m}_INVALID_ARGUMENT);
  }
  void begin_transfer(const std::shared_ptr<InputMoveSignal>& signal) noexcept { transfer_.store(signal); }
  void finish_transfer(const std::shared_ptr<InputMoveSignal>& signal) noexcept;
` : ""}
};
class State final : public std::enable_shared_from_this<State> {
  ${p}_session *session_ = nullptr;
  const pid_t process_ = ::getpid();
  const std::thread::id thread_ = std::this_thread::get_id();
  std::atomic<bool> closed_{false}, exited_{false};
  std::mutex mutex_;
  std::list<std::shared_ptr<Slot>> slots_;
  friend class Lease;
  bool owner_thread() const noexcept { return process_ == ::getpid() && thread_ == std::this_thread::get_id(); }
  void affinity() const {
    if (process_ != ::getpid()) throw Error(${m}_WRONG_PROCESS);
    if (exited_.load()) throw Error(${m}_CLOSED);
    if (thread_ != std::this_thread::get_id()) throw Error(${m}_WRONG_THREAD);
  }
  void release(const std::shared_ptr<Slot>& slot) noexcept {
    if (process_ != ::getpid() || exited_.load()) return;
    {
      std::lock_guard lock(mutex_);
      if (!slot->owner.load()) return;
      slot->pending = true;
    }
    if (owner_thread()) drain();
  }
public:
  State() { checked(${p}_session_open(&session_)); }
  State(const State&) = delete;
  State& operator=(const State&) = delete;
  ~State() { retire(); }
  bool closed() const noexcept { return process_ != ::getpid() || closed_.load() || exited_.load(); }
  void drain() noexcept {
    if (!owner_thread() || exited_.load()) return;
    for (;;) {
      std::shared_ptr<Slot> selected;
      ${p}_result *owner = nullptr;
      {
        std::lock_guard lock(mutex_);
        for (const auto& slot : slots_) if (slot->pending && slot->owner.load()) {
          selected = slot; owner = slot->owner.exchange(nullptr); break;
        }
      }
      if (!selected) return;
      (void)${p}_result_release(&owner);
      {
        std::lock_guard lock(mutex_);
        if (owner) { selected->owner.store(owner); return; }
        slots_.remove(selected);
      }
    }
  }
  ${p}_session *require() {
    affinity();
    if (closed_.load()) throw Error(${m}_CLOSED);
    drain(); return session_;
  }
  std::shared_ptr<Lease> adopt(NativeOwner& owner) {
    (void)require();
    if (!owner.value) throw Error(${m}_INVALID_ARGUMENT);
    auto slot = std::make_shared<Slot>();
    // Allocate every C++ control before moving native ownership out of the guard.
    auto lease = std::shared_ptr<Lease>(new Lease(shared_from_this(), slot));
    {
      std::lock_guard lock(mutex_);
      slots_.push_back(slot);
      slot->owner.store(owner.value); owner.value = nullptr;
    }
    return lease;
  }
  std::shared_ptr<Lease> borrow(const std::shared_ptr<BorrowScope>& scope) {
    (void)require();
    if (!scope || !scope->active.load()) throw Error(${m}_CLOSED);
    return std::shared_ptr<Lease>(new Lease(shared_from_this(), scope));
  }
  void close() {
    affinity();
    if (!closed_.load()) { checked(${p}_session_close(&session_)); closed_.store(true); }
    {
      std::lock_guard lock(mutex_);
      for (const auto& slot : slots_) slot->pending = true;
    }
    drain();
  }
  void retire() noexcept {
    if (!owner_thread() || exited_.load()) return;
    try { close(); } catch (...) { return; }
    // No new adoption is possible after close. Mark thread exit only after all
    // registered owners have been visited on their native creating thread.
    exited_.store(true);
  }
};
inline Lease::~Lease() { if (slot_) state_->release(slot_); }
inline bool Lease::closed() const noexcept {
  return state_->closed() || ${transferredInputs ? "transferred() || " : ""}(borrow_ ? !borrow_->active.load() : !slot_->owner.load());
}
inline void Lease::require() const {
  (void)state_->require();
  if (${transferredInputs ? "transferred() || (" : ""}borrow_ ? !borrow_->active.load() : !slot_->owner.load()${transferredInputs ? ")" : ""}) throw Error(${m}_CLOSED);
}
${transferredInputs ? `inline void Lease::finish_transfer(const std::shared_ptr<InputMoveSignal>& signal) noexcept {
  if (signal->consumed()) { transferred_.store(true); state_->release(slot_); }
  transfer_.store(nullptr);
}
` : ""}struct BorrowFrame {
  std::shared_ptr<BorrowScope> scope = std::make_shared<BorrowScope>();
  std::shared_ptr<Lease> lease;
  explicit BorrowFrame(const std::shared_ptr<State>& state) : lease(state->borrow(scope)) {}
  BorrowFrame(const BorrowFrame&) = delete;
  BorrowFrame& operator=(const BorrowFrame&) = delete;
  ~BorrowFrame() { scope->active.store(false); }
};
struct LocalState {
  std::shared_ptr<State> value;
  ~LocalState() { if (value) value->retire(); }
};
inline std::shared_ptr<State> current_state() {
  static thread_local LocalState local;
  if (!local.value) local.value = std::make_shared<State>();
  (void)local.value->require(); return local.value;
}
struct ResourceAccess;
template<class Kind> struct ResourceOps;
}
template<class Kind> class Resource {
  std::shared_ptr<detail::Lease> lease_;
  void *handle_ = nullptr;
  Resource(std::shared_ptr<detail::Lease> lease, void *handle) noexcept
    : lease_(std::move(lease)), handle_(handle) {}
  friend struct detail::ResourceAccess;
public:
  Resource() noexcept = default;
  Resource(const Resource&) noexcept = default;
  Resource& operator=(const Resource&) noexcept = default;
  Resource(Resource&& other) noexcept
    : lease_(std::move(other.lease_)), handle_(std::exchange(other.handle_, nullptr)) {}
  Resource& operator=(Resource&& other) noexcept {
    if (this != &other) { lease_ = std::move(other.lease_); handle_ = std::exchange(other.handle_, nullptr); }
    return *this;
  }
  void close() noexcept { lease_.reset(); handle_ = nullptr; }
  bool is_closed() const noexcept { return !lease_ || !handle_ || lease_->closed(); }
  Resource retain() const { return detail::ResourceOps<Kind>::retain(*this); }
  template<class... Args> decltype(auto) operator()(Args&&... args) const
    requires requires { detail::ResourceOps<Kind>::call(*this, std::forward<Args>(args)...); } {
    return detail::ResourceOps<Kind>::call(*this, std::forward<Args>(args)...);
  }
  friend bool operator==(const Resource& a, const Resource& b) noexcept {
    return a.handle_ == b.handle_ && ((!a.lease_ && !b.lease_)
      || (a.lease_ && b.lease_ && a.lease_->state() == b.lease_->state()));
  }
};
namespace detail {
struct ResourceAccess {
  template<class Kind> static Resource<Kind> make(std::shared_ptr<Lease> lease, void *handle) {
    if (!lease || !handle) throw Error(${m}_INVALID_ARGUMENT);
    lease->require(); return Resource<Kind>(std::move(lease), handle);
  }
  ${transferredInputs ? `template<class Kind> static std::shared_ptr<Lease> lease(const Resource<Kind>& value, const std::shared_ptr<State>& state) {
    if (!value.lease_ || !value.handle_) throw Error(${m}_CLOSED);
    value.lease_->require_transfer();
    if (value.lease_->state() != state) throw Error(${m}_INVALID_ARGUMENT);
    return value.lease_;
  }
  ` : ""}template<class Native, class Kind> static Native get(const Resource<Kind>& value, const std::shared_ptr<State>& state) {
    if (!value.lease_ || !value.handle_) throw Error(${m}_CLOSED);
    value.lease_->require();
    if (value.lease_->state() != state) throw Error(${m}_INVALID_ARGUMENT);
    return reinterpret_cast<Native>(value.handle_);
  }
};
}
`;
};
