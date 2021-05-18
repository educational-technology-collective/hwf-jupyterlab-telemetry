import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin,
  JupyterLab
} from "@jupyterlab/application";

import {
  IDocumentManager
} from "@jupyterlab/docmanager";

import {
  INotebookTracker,
  NotebookPanel,
  INotebookModel,
  Notebook,
  NotebookActions
} from "@jupyterlab/notebook";

import {
  Cell,
  CodeCell,
  ICellModel
} from "@jupyterlab/cells";

import {
  IObservableList,
  IObservableUndoableList,
  IObservableString
} from "@jupyterlab/observables";

import { IOutputAreaModel } from "@jupyterlab/outputarea";

import { INotebookContent } from "@jupyterlab/nbformat";

import {
  DocumentRegistry
} from "@jupyterlab/docregistry";

import {
  requestAPI
} from "./handler";

import {
  AWSAPIGatewayHandler
} from "./aws_api_gateway_handler"

import {
  ICellMeta,
  IHandler
} from "./types";

import { 
  SaveNotebookEvent, 
  CellExecutedEvent, 
  ScrollEvent, 
  ActiveCellChangedEvent, 
  OpenNotebookEvent, 
  AddCellEvent, 
  RemoveCellEvent 
} from "./events";

import { ISettingRegistry } from "@jupyterlab/settingregistry";

export class NotebookState {

  private _notebook: Notebook;
  private _cellState: WeakMap<Cell<ICellModel>, { changed: boolean, output: string }>;
  private _seq: number;

  constructor({ notebookPanel }: { notebookPanel: NotebookPanel }) {

    this._notebook = notebookPanel.content;
    this._cellState = new WeakMap<Cell<ICellModel>, { changed: boolean, output: string }>();
    this._seq = 0;

    this.updateCellState = this.updateCellState.bind(this);

    this.updateCellState();
    //  The notebook loaded; hence, update the cell state.

    this._notebook.model.cells.changed.connect((
      sender: IObservableUndoableList<ICellModel>,
      args: IObservableList.IChangedArgs<ICellModel>
    ) => {

      if (args.type == "add") {

        this.updateCellState();
        //  A cell was added; hence, update the cell state.
      }
    }, this);
  }

  updateCellState() {

    this._notebook.widgets.forEach((cell: Cell<ICellModel>) => {

      if (!this._cellState.has(cell)) {

        this._cellState.set(cell, { changed: true, output: this.createCellOutput(cell) });
        //  It's a new cell; hence, the changed state is set to true.

        ////  This is a new cell; hence, add handlers that check for changes in the inputs and outputs.
        cell.inputArea.model.value.changed.connect(
          (sender: IObservableString, args: IObservableString.IChangedArgs) => {
            let state = this._cellState.get(cell);
            state.changed = true;
            //  The input area changed; hence, the changed state is set to true.
          });

        if (cell.model.type == "code") {

          (cell as CodeCell).model.outputs.changed.connect(
            (sender: IOutputAreaModel, args: IOutputAreaModel.ChangedArgs
            ) => {
              if (args.type == "add") {
                //  An output has been added to the cell; hence, compare the current state with the new state.
                let state = this._cellState.get(cell);
                let output = this.createCellOutput(cell);
                if (output !== state.output) {
                  //  The output has changed; hence, set changed to true and update the output state.
                  state.changed = true;
                  state.output = output;
                }
                else {
                  //  The output hasn't changed; hence, leave the state as is.
                }
              }
            });
        }
      }
    });
  }

  private createCellOutput(cell: Cell<ICellModel>) {
    //  Combine the cell outputs into a string in order to check for changes.

    let output = "";

    if (cell.model.type == "code") {

      let outputs = (cell as CodeCell).model.outputs;

      for (let index = 0; index < outputs.length; index++) {

        for (let key of Object.keys(outputs.get(index).data).sort()) {
          output = output + JSON.stringify(outputs.get(index).data[key]);
        }
      }
      return output;
    }

    return "";
  }

  getNotebookState(): { notebook: INotebookContent, seq: number } {

    let nbFormatNotebook = (this._notebook.model.toJSON() as INotebookContent);

    for (let index = 0; index < this._notebook.widgets.length; index++) {

      let cell: Cell<ICellModel> = this._notebook.widgets[index];

      if (this._cellState.get(cell).changed === false) {
        //  The cell has not changed; hence, the notebook format cell will contain just its id.

        (nbFormatNotebook.cells[index] as any) = { id: nbFormatNotebook.cells[index].id };
      }
    }

    this._notebook.widgets.forEach((cell: Cell<ICellModel>) => {
      this._cellState.get(cell).changed = false;
      //  The cell state has been captured; hence, set all states to not changed.
    });

    let msg = {
      notebook: nbFormatNotebook,
      seq: this._seq
    }

    this._seq = this._seq + 1;

    return msg;
  }
}

export class EventMessageHandler {

  private _handlers: Array<IHandler>;
  private _userId: string;
  private _path: string;
  private _seq: number;

  constructor(
    { handlers, userId, path }:
      { handlers: Array<IHandler>, userId: string, path: string}
  ) {

    this._handlers = handlers;
    this._userId = userId;
    this._path = path;

    this.message = this.message.bind(this);
  }

  message(eventMessage: any) {

    eventMessage = { ...eventMessage, ...{ user_id: this._userId, notebook_path: this._path} };

    for (let handler of this._handlers) {
      handler.handle(eventMessage);
    }
  }
}

const PLUGIN_ID = 'hwf-jupyterlab-telemetry:plugin';

/**
 * Initialization data for the etc-jupyterlab-telemetry extension.
 */
const extension: JupyterFrontEndPlugin<object> = {
  id: PLUGIN_ID,
  autoStart: true,
  requires: [
    INotebookTracker,
    IDocumentManager,
    ISettingRegistry
  ],
  activate: (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    documentManager: IDocumentManager,
    settingRegistry: ISettingRegistry
  ) => {
    console.log("JupyterLab extension hwf-jupyterlab-telemetry is activated!");

    (async function () {

      let resource: string = "id";
      let userId: string;

      // try { // to get the user userId.
      //   userId = await requestAPI<any>(resource);
      // } catch (e) {
      //   console.error(`Error on GET /etc-jupyterlab-telemetry/${resource}.\n${e}`);
      // }

      // userId = (userId == "UNDEFINED" ? app.serviceManager.settings.serverSettings.token : userId);

      userId = app.serviceManager.settings.serverSettings.token;

      notebookTracker.widgetAdded.connect(async (sender: INotebookTracker, notebookPanel: NotebookPanel) => {

        let settings: ISettingRegistry.ISettings;
        let awsAPIGatewayHandler: IHandler;

        await notebookPanel.revealed;
        await notebookPanel.sessionContext.ready;
        await app.restored; // before getting the Settings.

        settings = await settingRegistry.load(PLUGIN_ID); // in order to get settings.

        if (!awsAPIGatewayHandler) {

          awsAPIGatewayHandler = new AWSAPIGatewayHandler({
            settings: settings,
            url: "https://telemetry.mentoracademy.org",
            bucket: "telemetry-s3-aws-edtech-labs-si-umich-edu",
            path: "refactor-test"
          });
        }

        let notebookState = new NotebookState({ notebookPanel: notebookPanel });

        let eventMessageHandler = new EventMessageHandler({ 
          handlers: [awsAPIGatewayHandler], 
          userId,  
          path: notebookPanel.context.path
        });

        new SaveNotebookEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings,
          handler: eventMessageHandler
        });

        new CellExecutedEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings,
          handler: eventMessageHandler
        });

        new ScrollEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings,
          handler: eventMessageHandler
        });

        new ActiveCellChangedEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings,
          handler: eventMessageHandler
        });

        new OpenNotebookEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings,
          handler: eventMessageHandler
        });

        new AddCellEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings,
          handler: eventMessageHandler
        });

        new RemoveCellEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings,
          handler: eventMessageHandler
        });

      });

    })();

    return {};
  }
};

export default extension;

