import caliper
from datetime import datetime
import os
from .eventsink import EventSink
import pytz
from caliper.base import ensure_type
from caliper.constants import ENTITY_TYPES


# class JupyterEvent(caliper.events.Event):
class JupyterEvent(caliper.events.ToolUseEvent):
    def __init__(self, **kwargs):
        # super().__init__(self, **kwargs)
        super().__init__()
        ensure_type(self.actor, ENTITY_TYPES["PERSON"])
        ensure_type(self.object, ENTITY_TYPES["SOFTWARE_APPLICATION"])
        ensure_type(self.target, ENTITY_TYPES["SOFTWARE_APPLICATION"],
                    optional=True)
        ensure_type(
            self.generated, ENTITY_TYPES["AGGREGATE_MEASURE_COLLECTION"],
            optional=True
        )

    # def __init__(self, **kwargs):
    #     ensure_type(self.actor, ENTITY_TYPES["PERSON"])
    #     ensure_type(self.target, ENTITY_TYPES["SOFTWARE_APPLICATION"], optional=True)
    #     ensure_type(self.generated, ENTITY_TYPES["AGGREGATE_MEASURE_COLLECTION"], optional=True)


class CaliperSink(EventSink):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Note: the "lti.tools" URL can be opened in browser to see 
        # events that have been sent to the endpoint
        endpointUrl = 'https://lti.tools/caliper/event?key=hwf-jupyter-lsloan&limit=0'
        endpointKey = 'your-caliper-endpoint-key'

        config = caliper.HttpOptions(
            host=endpointUrl,
            auth_scheme='Bearer',
            api_key=endpointKey)

        sensor = caliper.build_simple_sensor(
            sensor_id='urn:umich:jupyter:sensor',
            config_options=config,
        )
        sensor.config.DEBUG = True

        # `os.getenv('USER')` useful in some env., maybe not in Docker-based one
        actor = caliper.entities.Person(
            id='urn:umich:jupyter:user:' + os.getenv('USER'))

        ed_app = caliper.entities.SoftwareApplication(
            id='urn:umich:jupyter:notebook')

        self.sensor = sensor
        self.actor = actor
        self.ed_app = ed_app

    def handle_event(self, event: dict, metadata: dict):
        """
        TODO: We need to batch events (e.g., send 100 events in 1 batch)
        """
        # caliper-python requires a very specific date-time format:
        # ISO 8601 string with milliseconds and "Z" to represent GMT.
        event_time = datetime.now(tz=pytz.UTC).isoformat()[:23] + 'Z'

        # make this the specific notebook file in S3
        object = caliper.entities.SoftwareApplication(
            id='urn:umich:jupyter:notebook:notebook_id_here')

        # event = caliper.events.Event( # complains abt. missing UUID
        # event = JupyterEvent( # error when calling super
        event = caliper.events.ToolUseEvent(
            action=caliper.constants.CALIPER_ACTIONS['USED'],
            eventTime=event_time,
            actor=self.actor,
            edApp=self.ed_app,
            object=object,
            extensions={
                "event": event,
                "metadata": metadata,
            },
            session={}  # some representation of running JupyterLab app
        )

        # described_objects are those represented as ID only.
        self.sensor.send(event, described_objects=(
            self.actor.id, self.ed_app.id, object.id))
