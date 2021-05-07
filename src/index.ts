import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { requestAPI } from './handler';

/**
 * Initialization data for the hwf-jupyterlab-telemetry extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'hwf-jupyterlab-telemetry:plugin',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log('JupyterLab extension hwf-jupyterlab-telemetry is activated!');

    requestAPI<any>('get_example')
      .then(data => {
        console.log(data);
      })
      .catch(reason => {
        console.error(
          `The hwf-jupyterlab-telemetry server extension appears to be missing.\n${reason}`
        );
      });
  }
};

export default extension;
