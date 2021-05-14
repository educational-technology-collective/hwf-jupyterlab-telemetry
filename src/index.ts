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

import { IOutputAreaModel } from '@jupyterlab/outputarea';

import { INotebookContent } from '@jupyterlab/nbformat';

import {
  DocumentRegistry
} from "@jupyterlab/docregistry";


import {
  requestAPI
} from './handler';


import {
  ICellMeta,
  IHandler
} from './types';


class EventMessageHandler {

  private _notebookState;
  private _seq: number;

  constructor(
    { notebookState, handler }:
      { notebookState: NotebookState, handler: IHandler }
  ) {

    this._notebookState = notebookState;
    this._seq = 0;

    this.message = this.message.bind(this);
  }

  async message(name: string, cells: Array<any>) {

    try {

      let notebook = this._notebookState.notebook;
      let cellState = this._notebookState.cellState;

      let nbFormatNotebook = (notebook.model.toJSON() as INotebookContent);

      for (let index = 0; index < this._notebookState.notebook.widgets.length; index++) {

        let cell: Cell<ICellModel> = this._notebookState.notebook.widgets[index];

        if (cellState.get(cell).changed === false) {
          //  The cell has not changed; hence, the notebook format cell will contain just its id.

          (nbFormatNotebook.cells[index] as any) = { id: nbFormatNotebook.cells[index].id };
        }
      }

      this._seq = this._seq + 1;

      let message = {
        name: name,
        notebook: nbFormatNotebook,
        cells: cells,
        seq: this._seq
      }

      this._notebookState.notebook.widgets.forEach((cell: Cell<ICellModel>) => {
        cellState.get(cell).changed = false;
        //  The cell state has been captured; hence, set all states to not changed.
      });

      let response: string;

      try { // to get the user id.
        response = await requestAPI<any>('event', { method: 'POST', body: JSON.stringify(message) });
      } catch (reason) {

        console.error(reason);
      }

      console.log("Response: ",response);
    }
    catch (e) {
      console.error(e);

      setTimeout(this.message, 1000, name, cells);
    }
  }
}

class NotebookState {

  public notebook: Notebook;
  public cellState: WeakMap<Cell<ICellModel>, { changed: boolean, output: string }>;

  constructor({ notebook }: { notebook: Notebook }) {

    this.notebook = notebook;
    this.cellState = new WeakMap<Cell<ICellModel>, { changed: boolean, output: string }>();

    this.updateCellState = this.updateCellState.bind(this);

    this.updateCellState();
    //  The notebook loaded; hence, we update the cell state.

    this.notebook.model.cells.changed.connect((
      sender: IObservableUndoableList<ICellModel>,
      args: IObservableList.IChangedArgs<ICellModel>
    ) => {

      if (args.type == "add") {

        this.updateCellState();
        //  A cell was added; hence, we update the cell state.
      }
    }, this);
  }

  updateCellState() {

    this.notebook.widgets.forEach((cell: Cell<ICellModel>) => {

      if (!this.cellState.has(cell)) {

        this.cellState.set(cell, { changed: true, output: this.cellOutput(cell) });
        //  It's a new cell; hence, the changed state is set to true.

        cell.inputArea.model.value.changed.connect(
          (sender: IObservableString, args: IObservableString.IChangedArgs) => {
            let state = this.cellState.get(cell);
            state.changed = true;
            //  The input area changed; hence, the changed state is set to true.
          });

        if (cell.model.type == "code") {

          (cell as CodeCell).model.outputs.changed.connect(
            (sender: IOutputAreaModel, args: IOutputAreaModel.ChangedArgs
            ) => {
              if (args.type == "add") {
                //  An output has been added to the cell; hence, compare the current state with the new state.
                let state = this.cellState.get(cell);
                let output = this.cellOutput(cell);
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

  cellOutput(cell: Cell<ICellModel>) {

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
}

class CellsChangedEvent {

  private _handler: EventMessageHandler;
  private _notebook: Notebook;

  constructor(
    { notebook, handler }:
      { notebook: Notebook, handler: EventMessageHandler }) {

    this._notebook = notebook;
    this._handler = handler;

    this._notebook.model.cells.changed.connect(this.event, this);
  }

  event(
    sender: IObservableUndoableList<ICellModel>,
    args: IObservableList.IChangedArgs<ICellModel>) {

    if (args.type == "remove") {
      this._handler.message("remove_cell", [{ id: args.oldValues[0].id, index: args.oldIndex }]);
    }
    else if (args.type == "add") {
      this._handler.message("add_cell", [{ id: args.newValues[0].id, index: args.newIndex }]);
    }
    else {
      console.log(`Unrecognized cellsChanged event: ${args.type}`)
    }
  }
}

class SaveNotebookEvent {

  private _handler: EventMessageHandler;
  private _notebookPanel: NotebookPanel;

  constructor(
    { notebookPanel, handler }:
      { notebookPanel: NotebookPanel, handler: EventMessageHandler }) {

    this._notebookPanel = notebookPanel;
    this._handler = handler;

    this._notebookPanel.context.saveState.connect(this.event, this);
  }

  event(
    context: DocumentRegistry.IContext<INotebookModel>,
    saveState: DocumentRegistry.SaveState
  ): void {

    let cell: Cell<ICellModel>;
    let cellIds: Array<ICellMeta>;
    let index: number;

    if (saveState == "completed") {

      cellIds = [];

      for (index = 0; index < this._notebookPanel.content.widgets.length; index++) {

        cell = this._notebookPanel.content.widgets[index];

        if (this._notebookPanel.content.isSelectedOrActive(cell)) {

          cellIds.push({ id: cell.model.id, index });
        }
      }

      this._handler.message("save_notebook", cellIds);
    }
  }
}

class CellExecutedEvent {

  private _handler: EventMessageHandler;
  private _notebook: Notebook;

  constructor(
    { notebook, handler }:
      { notebook: Notebook, handler: EventMessageHandler }) {

    this._notebook = notebook;
    this._handler = handler;

    NotebookActions.executed.connect(this.event, this);
  }

  event(_: any, args: { notebook: Notebook; cell: Cell<ICellModel> }): void {

    if (args.notebook.model === this._notebook.model) {

      this._handler.message("execute_cell", [
        {
          id: args.cell.model.id,
          index: this._notebook.widgets.findIndex((value: Cell<ICellModel>) => value == args.cell)
        }
      ]);
    }
  }
}

class ScrollEvent {

  private _handler: EventMessageHandler;
  private _notebook: Notebook;
  private _timeout: number;

  constructor(
    { notebook, handler }:
      { notebook: Notebook, handler: EventMessageHandler }) {

    this._notebook = notebook;
    this._handler = handler;

    this._notebook.node.addEventListener("scroll", this.event.bind(this), false);
  }

  event(e: Event): void {

    e.stopPropagation();

    clearTimeout(this._timeout);

    this._timeout = setTimeout(() => {

      let cellIds: Array<ICellMeta> = [];
      let cell: Cell<ICellModel>;
      let index: number;
      let id: string;

      for (index = 0; index < this._notebook.widgets.length; index++) {

        cell = this._notebook.widgets[index];

        let cellTop = cell.node.offsetTop;
        let cellBottom = cell.node.offsetTop + cell.node.offsetHeight;
        let viewTop = this._notebook.node.scrollTop;
        let viewBottom = this._notebook.node.scrollTop + this._notebook.node.clientHeight;

        if (cellTop > viewBottom || cellBottom < viewTop) {
          continue;
        }

        id = cell.model.id;

        cellIds.push({ id, index });
      }

      this._handler.message("scroll", cellIds);

    }, 1000);

  }
}

class ActiveCellChangedEvent {

  private _handler: EventMessageHandler;
  private _notebook: Notebook;

  constructor(
    { notebook, handler }:
      { notebook: Notebook, handler: EventMessageHandler }) {

    this._notebook = notebook;
    this._handler = handler;

    this._notebook.activeCellChanged.connect(this.event, this);
  }

  event(send: Notebook, args: Cell<ICellModel>): void {

    this._handler.message("active_cell_changed", [
      {
        id: args.model.id,
        index: this._notebook.widgets.findIndex((value: Cell<ICellModel>) => value == args)
      }
    ]);
  }
}

class OpenNotebookEvent {

  private _handler: EventMessageHandler;
  private _notebook: Notebook;

  constructor(
    { notebook, handler }:
      { notebook: Notebook, handler: EventMessageHandler }) {

    this._notebook = notebook;
    this._handler = handler;

    setTimeout(this.event.bind(this));
  }

  event(): void {
    this._handler.message(
      "open_notebook",
      this._notebook.widgets.map((cell: Cell<ICellModel>, index: number) =>
        ({ id: cell.model.id, index: index })
      ));
  }
}

/**
 * Initialization data for the hwf-jupyterlab-telemetry extension.
 */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'hwf-jupyterlab-telemetry:plugin',
  autoStart: true,
  requires: [INotebookTracker,
    IDocumentManager,
    JupyterFrontEnd.IPaths,
    JupyterLab.IInfo],
  activate: async (app: JupyterFrontEnd,
    notebookTracker: INotebookTracker,
    documentManager: IDocumentManager,
    info: JupyterLab.IInfo) => {
    console.log('JupyterLab extension hwf-jupyterlab-telemetry is activated!');

    let handler: IHandler;


    notebookTracker.widgetAdded.connect(async (sender: INotebookTracker, notebookPanel: NotebookPanel) => {

      await notebookPanel.revealed;
      await notebookPanel.sessionContext.ready;

      let notebookState = new NotebookState({ notebook: notebookPanel.content });

      let eventMessageHandler = new EventMessageHandler({ notebookState, handler });

      console.log(notebookPanel.content);

      new OpenNotebookEvent({ notebook: notebookPanel.content, handler: eventMessageHandler })
      new CellsChangedEvent({ notebook: notebookPanel.content, handler: eventMessageHandler });
      new SaveNotebookEvent({ notebookPanel: notebookPanel, handler: eventMessageHandler });
      new CellExecutedEvent({ notebook: notebookPanel.content, handler: eventMessageHandler });
      new ScrollEvent({ notebook: notebookPanel.content, handler: eventMessageHandler });
      new ActiveCellChangedEvent({ notebook: notebookPanel.content, handler: eventMessageHandler });

    });

  }
};

export default extension;
