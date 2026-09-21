import Variants.Extra

namespace Variants

-- Keep the shared fixture unchanged. Ruby reserves the name `inspect`.
def inspect_scalars (value : Scalars) : Bool := inspect value

end Variants
