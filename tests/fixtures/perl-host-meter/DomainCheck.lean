namespace DomainCheck
opaque Ref : Type

@[export lbp_test_compare]
unsafe def same (a b : Ref) : Bool := ptrEq a b

@[export lbp_test_echo]
def echo (a : Ref) : Ref := a
end DomainCheck
