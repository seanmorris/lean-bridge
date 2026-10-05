import Aliases

namespace Aliases

-- Keep the shared fixture unchanged. Ruby reserves the name `inspect`.
def inspect_scalars (value : ScalarsView) : Bool := inspect value

end Aliases
