import Variants.Extra

namespace Variants

-- Keep the shared fixture unchanged. PHP reserves the name `echo`.
def echo_signal (value : Signal) : Signal := echo value

end Variants
