prelude
import Init.Data.SInt.Basic

namespace Immediate

def ready (value : Int64) : Task Int64 := Task.pure value

end Immediate
