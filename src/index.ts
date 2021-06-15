import {
  ILayoutRestorer,
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

import { IMainMenu } from '@jupyterlab/mainmenu';

import { Menu, Widget, DockLayout } from '@lumino/widgets';

import {
  ICommandPalette,
  MainAreaWidget,
  WidgetTracker
} from '@jupyterlab/apputils';

import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

import { addIcon, clearIcon, listIcon } from '@jupyterlab/ui-components';

import { requestAPI } from "./handler";


import {
  NotebookSaveEvent,
  CellExecutionEvent,
  NotebookScrollEvent,
  ActiveCellChangeEvent,
  NotebookOpenEvent,
  CellAddEvent,
  CellRemoveEvent
} from "./events";

import { ISettingRegistry } from "@jupyterlab/settingregistry";

import { Message, MessageLoop } from '@lumino/messaging';

import { IDisposable } from '@lumino/disposable';

import { ISignal, Signal } from '@lumino/signaling';


export interface IHandler {
  handle(msg: any): Promise<any> | void;
}

export class NotebookState {

  private _notebook: Notebook;
  private _cellState: WeakMap<Cell<ICellModel>, { changed: boolean, output: string }>;
  private _seq: number;

  constructor({ notebookPanel }: { notebookPanel: NotebookPanel }) {

    this._notebook = notebookPanel.content;
    this._cellState = new WeakMap<Cell<ICellModel>, { changed: boolean, output: string }>();
    this._seq = 0;

    this.updateCellState();
    //  The notebook loaded; hence, update the cell state.

    this._notebook.model?.cells.changed.connect((
      sender: IObservableUndoableList<ICellModel>,
      args: IObservableList.IChangedArgs<ICellModel>
    ) => {

      if (args.type == "add") {

        this.updateCellState();
        //  A cell was added; hence, update the cell state.
      }
    }, this);
  }

  private updateCellState() {

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

    let state = {
      notebook: nbFormatNotebook,
      seq: this._seq
    }

    this._seq = this._seq + 1;

    return state;
  }
}

export class MessageAdapter {

  private _notebookPanel: NotebookPanel;
  private _userId: string;

  constructor(
    { userId, notebookPanel }:
      { userId: string, notebookPanel: NotebookPanel }
  ) {
    this._userId = userId;
    this._notebookPanel = notebookPanel;
  }

  dispose() {
    Signal.disconnectAll(this);
  }

  async adaptMessage(sender: any, data: any) {

    try {
      data = { ...data, ...{ user_id: this._userId, notebook_path: this._notebookPanel.context.path } };

      let res = await requestAPI<any>('event', { method: 'POST', body: JSON.stringify(data) });
  
      console.log("JL Server Response: ", res)
    }
    catch (e) {
      console.error(e);
    }
  }
}

export const PLUGIN_ID = 'hwf-jupyterlab-telemetry:telemetry';

const extension: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  autoStart: true,
  requires: [
    INotebookTracker,
    ISettingRegistry
  ],
  activate: async (
    app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    settingRegistry: ISettingRegistry
  ) => {
    console.log("JupyterLab extension etc-jupyterlab-telemetry is activated!");

    let settings: ISettingRegistry.ISettings;
    let resource: string = "id";
    let userId: string;

    settings = await settingRegistry.load(PLUGIN_ID); // in order to get settings.

    userId = app.serviceManager.settings.serverSettings.token;

    notebookTracker.widgetAdded.connect(
      async (sender: INotebookTracker, notebookPanel: NotebookPanel) => {

        let notebookState: NotebookState;

        await notebookPanel.revealed;
        await notebookPanel.sessionContext.ready;

        let messageAdapter = new MessageAdapter({ userId, notebookPanel });

        notebookState = new NotebookState({ notebookPanel: notebookPanel });

        let notebookSaveEvent = new NotebookSaveEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings
        });

        notebookSaveEvent.notebookSaved.connect(messageAdapter.adaptMessage, messageAdapter);

        let cellExecutionEvent = new CellExecutionEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings
        });

        cellExecutionEvent.cellExecuted.connect(messageAdapter.adaptMessage, messageAdapter);

        let notebookScrollEvent = new NotebookScrollEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings
        });

        notebookScrollEvent.notebookScrolled.connect(messageAdapter.adaptMessage, messageAdapter);

        let activeCellChangeEvent = new ActiveCellChangeEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings
        });

        activeCellChangeEvent.activeCellChanged.connect(messageAdapter.adaptMessage, messageAdapter);

        let notebookOpenEvent = new NotebookOpenEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings
        });

        notebookOpenEvent.notebookOpened.connect(messageAdapter.adaptMessage, messageAdapter);

        let cellAddEvent = new CellAddEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings
        });

        cellAddEvent.cellAdded.connect(messageAdapter.adaptMessage, messageAdapter);

        let cellRemoveEvent = new CellRemoveEvent({
          notebookState: notebookState,
          notebookPanel: notebookPanel,
          settings
        });

        cellRemoveEvent.cellRemoved.connect(messageAdapter.adaptMessage, messageAdapter);

      });
  }
};

export default extension;

