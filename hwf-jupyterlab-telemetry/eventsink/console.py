from .eventsink import EventSink


class ConsoleSink(EventSink):
    """
    A simple event sink that logs events to stdout.
    """

    def handle_event(self, event: dict, metadata: dict):
        self.log.info("got telemetry event: %s %s", event, metadata)