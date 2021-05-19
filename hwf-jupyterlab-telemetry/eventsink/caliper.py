import caliper
from datetime import datetime
import os
from .eventsink import EventSink
import pytz
from caliper.base import ensure_type
from caliper.constants import ENTITY_TYPES


class CaliperSink(EventSink):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        # Note: the "lti.tools" URL may be opened in browser to see
        # events that have been sent to the endpoint
        endpointUrl = 'https://lti.tools/caliper/event?key=hwf-jupyter&limit=0'
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
        self.sensor = sensor

        # FIXME: `os.getenv('USER')` OK in some env., maybe not Docker ones
        self.actor = caliper.entities.Person(
            id='urn:umich:jupyter:user:' + os.getenv('USER'))

        self.ed_app = caliper.entities.SoftwareApplication(
            id='urn:umich:jupyter:notebook')

    def handle_event(self, eventData: dict, metadata: dict):
        """
        TODO: We need to batch events (e.g., send 100 events in 1 batch)
        """

        # caliper-python requires a very specific date-time format:
        # ISO 8601 string with milliseconds and "Z" for GMT.
        event_time = datetime.now(tz=pytz.UTC).isoformat()[:23] + 'Z'

        # TODO: make this reference the specific notebook file in S3
        object = caliper.entities.SoftwareApplication(
            id='urn:umich:jupyter:notebook:notebook_id_here')

        # TODO: find appropriate properties for important values
        extensions = {
            "eventData": eventData,
            "metadata": metadata,
        }

        # TODO: some representation of running JupyterLab app
        session={}

        event = caliper.events.ToolUseEvent(
            action=caliper.constants.CALIPER_ACTIONS['USED'],
            eventTime=event_time,
            actor=self.actor,
            edApp=self.ed_app,
            object=object,
            extensions=extensions,
            session=session
        )

        # `described_objects` are those represented as ID only
        self.sensor.send(event, described_objects=(
            self.actor.id, self.ed_app.id, object.id))
