import abc
import traitlets.config


class EventSink(traitlets.config.LoggingConfigurable):
    """
    A sink for JupyterLab telemetry events.

    Subclasses should do something useful with the event that are recieved
    (such as sending it to an event store or writing them to a file).
    """

    @abc.abstractmethod
    def handle_event(self, event: dict, metadata: dict):
        raise NotImplementedError()
