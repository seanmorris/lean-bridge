import lean_recursive as lb

lb.spine(lb.MarkerEmpty())
lb.forest([lb.SpineLeaf(1)])
lb.tree(None)
lb.envelope(lb.empty())
lb.units([1])
lb.marker(lb.MarkerUnit(0))
lb.LeftTreeNext(lb.LeftTreeLeaf(1))
lb.SpineLeaf(1).value = 2
lb.word_max("wrong")
lb.TreeBranch([lb.SpineLeaf(1)])
lb.join_trees(lb.empty(), lb.SpineLeaf(1))
wrong: int = lb.spine(lb.SpineLeaf(1))
