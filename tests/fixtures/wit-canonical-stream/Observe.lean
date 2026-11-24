import Meter

namespace Observe

def counts : BaseIO UInt64 := do
  let pulls ← Meter.feedPulls.get
  let closes ← Meter.feedCloses.get
  return pulls.toUInt64 * 4294967296 + closes.toUInt64

end Observe
