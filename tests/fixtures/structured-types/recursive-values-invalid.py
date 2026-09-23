import values as lb
import linked_values as linked

lb.SpineNext(1)
lb.SpineLeaf("wrong")
lb.TreeBranch([lb.SpineLeaf(1)])
lb.TreeLeaf(None)
lb.MarkerUnit(0)
lb.MarkerNext(lb.SpineLeaf(1))
lb.LeftTreeNext(lb.LeftTreeLeaf(1))
lb.SpineLeaf(1).value = 2
lb.Forest = "wrong"
linked.Link(linked.Some(lb.SpineLeaf(1)), 2)
