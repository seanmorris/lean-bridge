import { hashBindingIr } from "../../binding-ir/canonical.mjs";
import { validateBindingIr } from "../../binding-ir/contract.mjs";

const exactAlphaShape = ir => {
  const declarations = ir.declarations.map(item => item.id);
  const expected = [
    "lean:Alpha.box",
    "lean:Alpha.Box.read",
    "bridge:Alpha.Box.identity",
    "lean:Alpha.roundTrip",
    "lean:Alpha.withCallback",
    "lean:Alpha.makeAdder",
  ];
  if (JSON.stringify(declarations) !== JSON.stringify(expected)) {
    throw new Error("the C++ projection currently requires the reviewed Alpha fixture");
  }
};

const header = `#ifndef LEAN_ALPHA_HPP
#define LEAN_ALPHA_HPP

#include "lean_alpha.h"

#include <cstdint>
#include <exception>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

namespace lean_bridge::alpha {

class Error final : public std::runtime_error {
 public:
  Error(lean_alpha_status status, const lean_alpha_error& error)
      : std::runtime_error(error.message == nullptr ? "Lean call failed" : std::string(error.message, error.message_length)),
        status_(status), code_(error.code) {}
  lean_alpha_status status() const noexcept { return status_; }
  lean_alpha_error_code code() const noexcept { return code_; }

 private:
  lean_alpha_status status_;
  lean_alpha_error_code code_;
};

inline void check(lean_alpha_status status, const lean_alpha_error& error) {
  if (status != LEAN_ALPHA_STATUS_OK) throw Error(status, error);
}

struct Payload {
  bool enabled;
  std::uint32_t count;
  std::string label;
  std::vector<std::uint8_t> bytes;
  std::vector<std::uint32_t> values;
};

class Box final {
 public:
  explicit Box(std::uint32_t value) {
    lean_alpha_error error{};
    check(lean_alpha_box_create(value, &value_, &error), error);
  }
  Box(const Box&) = delete;
  Box& operator=(const Box&) = delete;
  Box(Box&& other) noexcept : value_(std::exchange(other.value_, nullptr)) {}
  Box& operator=(Box&& other) noexcept {
    if (this != &other) {
      close();
      value_ = std::exchange(other.value_, nullptr);
    }
    return *this;
  }
  ~Box() { close(); }

  std::uint32_t read() const {
    lean_alpha_error error{};
    std::uint32_t result = 0;
    check(lean_alpha_box_read(require_open(), &result, &error), error);
    return result;
  }
  const Box& identity() const {
    lean_alpha_error error{};
    const lean_alpha_box* result = nullptr;
    check(lean_alpha_box_identity(require_open(), &result, &error), error);
    if (result != value_) throw std::runtime_error("Lean returned a different Box identity");
    return *this;
  }
  void close() noexcept { lean_alpha_box_dispose(&value_); }
  bool closed() const noexcept { return value_ == nullptr; }

 private:
  lean_alpha_box* require_open() const {
    if (value_ == nullptr) throw std::runtime_error("Box is closed");
    return value_;
  }
  lean_alpha_box* value_ = nullptr;
};

class Transform final {
 public:
  explicit Transform(lean_alpha_owned_transform* value) noexcept : value_(value) {}
  Transform(const Transform&) = delete;
  Transform& operator=(const Transform&) = delete;
  Transform(Transform&& other) noexcept : value_(std::exchange(other.value_, nullptr)) {}
  Transform& operator=(Transform&& other) noexcept {
    if (this != &other) {
      close();
      value_ = std::exchange(other.value_, nullptr);
    }
    return *this;
  }
  ~Transform() { close(); }
  std::uint32_t operator()(std::uint32_t value) const {
    if (value_ == nullptr) throw std::runtime_error("Transform is closed");
    lean_alpha_error error{};
    std::uint32_t result = 0;
    check(lean_alpha_owned_transform_call(value_, value, &result, &error), error);
    return result;
  }
  void close() noexcept { lean_alpha_owned_transform_dispose(&value_); }
  bool closed() const noexcept { return value_ == nullptr; }

 private:
  lean_alpha_owned_transform* value_ = nullptr;
};

inline Payload round_trip(const Payload& value) {
  lean_alpha_payload input{
    value.enabled,
    value.count,
    {value.label.data(), value.label.size(), nullptr, nullptr},
    {value.bytes.data(), value.bytes.size(), nullptr, nullptr},
    {value.values.data(), value.values.size(), nullptr, nullptr},
  };
  lean_alpha_payload output{};
  lean_alpha_error error{};
  check(lean_alpha_round_trip(&input, &output, &error), error);
  try {
    Payload result{
      output.enabled,
      output.count,
      output.label.length == 0 ? std::string{} : std::string(output.label.data, output.label.length),
      output.bytes.length == 0 ? std::vector<std::uint8_t>{} : std::vector<std::uint8_t>(output.bytes.data, output.bytes.data + output.bytes.length),
      output.values.length == 0 ? std::vector<std::uint32_t>{} : std::vector<std::uint32_t>(output.values.data, output.values.data + output.values.length),
    };
    lean_alpha_payload_clear(&output);
    return result;
  } catch (...) {
    lean_alpha_payload_clear(&output);
    throw;
  }
}

template <typename Function>
std::uint32_t with_callback(std::uint32_t value, Function&& function) {
  using Callback = std::remove_reference_t<Function>;
  Callback callback = std::forward<Function>(function);
  struct Context {
    Callback* callback;
    std::exception_ptr exception;
  } context{&callback, nullptr};
  lean_alpha_transform native{
    [](void* context, std::uint32_t input, std::uint32_t* output, lean_alpha_error*) -> lean_alpha_status {
      auto* state = static_cast<Context*>(context);
      try {
        *output = (*state->callback)(input);
        return LEAN_ALPHA_STATUS_OK;
      } catch (...) {
        state->exception = std::current_exception();
        return LEAN_ALPHA_STATUS_DECLARED_ERROR;
      }
    },
    &context,
  };
  lean_alpha_error error{};
  std::uint32_t output = 0;
  const auto status = lean_alpha_with_callback(value, &native, &output, &error);
  if (context.exception) std::rethrow_exception(context.exception);
  check(status, error);
  return output;
}

inline Transform make_adder(std::uint32_t base) {
  lean_alpha_owned_transform* result = nullptr;
  lean_alpha_error error{};
  check(lean_alpha_make_adder(base, &result, &error), error);
  return Transform(result);
}

}  // namespace lean_bridge::alpha

#endif
`;

export const generateCppBindingPackage = irValue => {
  const ir = validateBindingIr(irValue);
  exactAlphaShape(ir);
  const files = {
    "include/lean_alpha.hpp": header,
    "src/lean_alpha.cpp": "#include \"lean_alpha.hpp\"\n",
    "README.md": `# ${ir.component.name} C++ binding\n\nTyped C++20 values and deterministic RAII wrappers over the generated native Lean component.\n`,
  };
  const manifest = {
    schemaVersion: 1,
    component: ir.component.id,
    bindingIrSha256: hashBindingIr(ir),
    generator: { id: "lean-wasm/cpp", version: 1 },
    languageStandard: "C++20",
    publicHeader: "include/lean_alpha.hpp",
    implementation: "src/lean_alpha.cpp",
    exports: ["Box", "Payload", "Transform", "round_trip", "with_callback", "make_adder"],
    capabilityGaps: [],
    files: ["include/lean_alpha.hpp", "src/lean_alpha.cpp", "README.md", "binding-manifest.json"],
  };
  files["binding-manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
  return Object.freeze(files);
};
