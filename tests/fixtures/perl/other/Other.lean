import Workshop

namespace Other
def value (counter : Workshop.Counter) : UInt32 := counter.value
def same (counter : Workshop.Counter) : Workshop.Counter := counter
def multiply (left right : UInt32) : UInt32 := left * right
end Other
