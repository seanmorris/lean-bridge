import LeanBridge.Host.Rust

open LeanBridge.Host.Rust
namespace Inspector

def increment (meter : Box) : IO Box := do
  meter.setLevel ((← meter.read) + 1)
  meter.identity

end Inspector
