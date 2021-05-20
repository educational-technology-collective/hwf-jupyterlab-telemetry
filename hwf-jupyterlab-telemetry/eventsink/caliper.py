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

        self.ed_app = caliper.entities.SoftwareApplication(
            id='urn:umich:jupyter:notebook')

    def handle_event(self, eventData: dict, metadata: dict):
        """
        TODO: We need to batch events (e.g., send 100 events in 1 batch)
        """

        # caliper-python requires a very specific date-time format:
        # ISO 8601 string with milliseconds and "Z" for GMT.
        event_time = datetime.now(tz=pytz.UTC).isoformat()[:23] + 'Z'

        actor = caliper.entities.Person(
            id='urn:umich:jupyter:user:' +
               eventData.get('user_id', '__unknown__'))

        # TODO: find appropriate properties for important values
        extensions = {"eventData": eventData,
                      "metadata": metadata,
                      }

        # TODO: some representation of running JupyterLab app
        session = {}

        objectId = eventData.get('path',
                                 'urn:umich:jupyter:notebook:__unknown__')

        eventType = eventData.get('event_name')

        if eventType in ['open_notebook', 'save_notebook']:
            object = caliper.entities.DigitalResource(
                id=objectId)

            action = caliper.constants.CALIPER_ACTIONS['SAVED'] \
                if eventType == 'save_notebook' else \
                caliper.constants.CALIPER_ACTIONS['RETRIEVED']

            event = caliper.events.ResourceManagementEvent(
                action=action,
                eventTime=event_time,
                actor=actor,
                edApp=self.ed_app,
                object=object,
                extensions=extensions,
                session=session
            )
        elif eventType in ['active_cell_changed', 'scroll']:
            object = caliper.entities.DigitalResource(
                id=objectId)

            event = caliper.events.NavigationEvent(
                action=caliper.constants.CALIPER_ACTIONS['NAVIGATED_TO'],
                eventTime=event_time,
                actor=actor,
                edApp=self.ed_app,
                object=object,
                extensions=extensions,
                session=session
            )
        else:
            # TODO: make this reference the specific notebook file in S3
            object = caliper.entities.SoftwareApplication(
                id=objectId)

            event = caliper.events.ToolUseEvent(
                action=caliper.constants.CALIPER_ACTIONS['USED'],
                eventTime=event_time,
                actor=actor,
                edApp=self.ed_app,
                object=object,
                extensions=extensions,
                session=session
            )

        # `described_objects` are those represented as ID only
        self.sensor.send(event, described_objects=(
            actor.id, self.ed_app.id, object.id))
