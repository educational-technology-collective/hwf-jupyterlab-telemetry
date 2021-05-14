from jupyter_server.base.handlers import APIHandler
from jupyter_server.serverapp import ServerApp
from jupyter_server.utils import url_path_join
import tornado
import traitlets
import traitlets.config

from .eventsink import EventSink
from .eventsink.caliper import CaliperSink

class TelemetryHandler(traitlets.config.LoggingConfigurable, APIHandler):
    def __init__(self, *args, event_sink, **kwargs):
        APIHandler.__init__(self, *args)
        traitlets.config.LoggingConfigurable.__init__(self, **kwargs)
        self.event_sink = event_sink

    metadata = traitlets.Dict(
        help=(
            "Metadata that is added to every single event. "
            "This can be used to add user- or environment-specific information "
            "to events."
        )
    ).tag(config=True)

    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    async def post(self):
        event = self.get_json_body()
        self.event_sink.handle_event(event, self.metadata)
        self.finish({ "ok": True })      


def setup_handlers(server_app: "ServerApp"):
    web_app = server_app.web_app
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    # Setup the event sink
    # We initialize it here so that we don't re-create it for every single event
    # TODO: add configuration option to use Caliper sink instead
    event_sink = CaliperSink(parent=server_app)
    
    # Register our handler for /hwf-juptyerlab-telemetry/event
    route_pattern = url_path_join(base_url, "hwf-jupyterlab-telemetry", "event")
    handlers = [
        # Third element dict(...) is passed as kwargs to TelemetryHandler constructor
        (route_pattern, TelemetryHandler, dict(parent=server_app, event_sink=event_sink)),
    ]
    web_app.add_handlers(host_pattern, handlers)
