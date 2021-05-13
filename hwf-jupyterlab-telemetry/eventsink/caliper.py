from .eventsink import EventSink


class CaliperSink(EventSink):
    def handle_event(self, event: dict, metadata: dict):
        raise NotImplementedError("TODO")
