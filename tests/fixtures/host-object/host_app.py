from weakref import WeakSet


class Box:
    instances = WeakSet()

    def __init__(self, value):
        self._level = value
        self.instances.add(self)

    @property
    def level(self):
        return self._level

    @level.setter
    def level(self, value):
        if not 0 <= value <= 100:
            raise ValueError("outside the host range")
        self._level = value

    def read(self):
        return self.level

    def identity(self):
        return self

    def same_as(self, other):
        return self is other

    def scale(self, factor):
        return self.level * factor

    def finish(self):
        return self.level

    @classmethod
    def live(cls):
        return len(cls.instances)
