
import {
    NotebookPanel,
    INotebookModel,
    Notebook,
    NotebookActions
} from "@jupyterlab/notebook";

import {
    Cell,
    ICellModel
} from "@jupyterlab/cells";

import {
    IObservableList,
    IObservableUndoableList,
    IObservableString
} from "@jupyterlab/observables";

import {
    DocumentRegistry
} from "@jupyterlab/docregistry";


import {
    ICellMeta
} from './types';

import { EventMessageHandler, NotebookState } from "./index"
import { ISettingRegistry } from "@jupyterlab/settingregistry";
import { SettingsSupplicant } from "./settings_supplicant";

interface INotebookEventOptions {
    notebookState: NotebookState;
    notebookPanel: NotebookPanel;
    handler: EventMessageHandler;
    settings: ISettingRegistry.ISettings;
}

export class SaveNotebookEvent extends SettingsSupplicant {

    private _notebookPanel: NotebookPanel;
    private _handler: EventMessageHandler;
    private _notebookState: NotebookState;

    constructor({ notebookState, notebookPanel, settings, handler }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/SaveNotebookEvent"
        });

        this._notebookState = notebookState;
        this._notebookPanel = notebookPanel;
        this._handler = handler;

    }

    event(
        context: DocumentRegistry.IContext<INotebookModel>,
        saveState: DocumentRegistry.SaveState
    ): void {

        let cell: Cell<ICellModel>;
        let cells: Array<ICellMeta>;
        let index: number;

        if (saveState == "completed") {

            cells = [];

            for (index = 0; index < this._notebookPanel.content.widgets.length; index++) {

                cell = this._notebookPanel.content.widgets[index];

                if (this._notebookPanel.content.isSelectedOrActive(cell)) {

                    cells.push({ id: cell.model.id, index });
                }
            }

            this._handler.message({
                ...{
                    event_name: "save_notebook",
                    cells: cells
                }, ...this._notebookState.getNotebookState()
            });
        }
    }

    enable(): void {
        this._notebookPanel.context.saveState.connect(this.event, this);
    }

    disable(): void {
        this._notebookPanel.context.saveState.disconnect(this.event, this);
    }
}

export class CellExecutedEvent extends SettingsSupplicant {

    private _notebook: Notebook;
    private _handler: EventMessageHandler;
    private _notebookState: NotebookState;

    constructor({ notebookState, notebookPanel, settings, handler }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/CellExecutedEvent"
        });

        this._notebookState = notebookState;
        this._handler = handler;

        this._notebook = notebookPanel.content;

    }

    event(_: any, args: { notebook: Notebook; cell: Cell<ICellModel> }): void {

        if (args.notebook.model === this._notebook.model) {

            let cells = [
                {
                    id: args.cell.model.id,
                    index: this._notebook.widgets.findIndex((value: Cell<ICellModel>) => value == args.cell)
                }
            ]

            this._handler.message({
                ...{
                    event_name: "cell_executed",
                    cells: cells
                }, ...this._notebookState.getNotebookState()
            });
        }
    }

    enable(): void {
        NotebookActions.executed.connect(this.event, this);
    }

    disable(): void {
        NotebookActions.executed.disconnect(this.event, this);
    }
}


export class ScrollEvent extends SettingsSupplicant {

    private _notebook: Notebook;
    private _handler: EventMessageHandler;
    private _notebookState: NotebookState;

    private _timeout: number;

    constructor({ notebookState, notebookPanel, handler, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/ScrollEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;
        this._handler = handler;

        this.event = this.event.bind(this);

    }

    event(e: Event): void {

        e.stopPropagation();

        clearTimeout(this._timeout);

        this._timeout = setTimeout(() => {

            let cells: Array<ICellMeta> = [];
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

                cells.push({ id, index });
            }

            this._handler.message({
                ...{
                    event_name: "scroll",
                    cells: cells
                }, ...this._notebookState.getNotebookState()
            });

        }, 1000);
    }

    enable(): void {
        this._notebook.node.addEventListener("scroll", this.event, false);
    }

    disable(): void {
        this._notebook.node.removeEventListener("scroll", this.event, false);
    }
}

export class ActiveCellChangedEvent extends SettingsSupplicant {

    private _handler: EventMessageHandler;
    private _notebook: Notebook;
    private _notebookState: NotebookState;

    constructor({ notebookState, notebookPanel, handler, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/ActiveCellChangedEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;
        this._handler = handler;

    }

    event(send: Notebook, args: Cell<ICellModel>): void {

        let cells = [
            {
                id: args.model.id,
                index: this._notebook.widgets.findIndex((value: Cell<ICellModel>) => value == args)
            }
        ];

        this._handler.message({
            ...{
                event_name: "active_cell_changed",
                cells: cells
            }, ...this._notebookState.getNotebookState()
        });
    }

    enable(): void {
        this._notebook.activeCellChanged.connect(this.event, this);
    }

    disable(): void {
        this._notebook.activeCellChanged.disconnect(this.event, this);
    }
}

export class OpenNotebookEvent extends SettingsSupplicant {

    private _handler: EventMessageHandler;
    private _notebook: Notebook;
    private _notebookState: NotebookState;
    private _enable: boolean;

    constructor({ notebookState, notebookPanel, handler, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/OpenNotebookEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;
        this._handler = handler;

        setTimeout(this.event.bind(this));
    }

    event(): void {

        if (!this._enable)
            return;

        let cells = this._notebook.widgets.map((cell: Cell<ICellModel>, index: number) =>
            ({ id: cell.model.id, index: index })
        );

        this._handler.message({
            ...{
                event_name: "open_notebook",
                cells: cells
            }, ...this._notebookState.getNotebookState()
        });
    }

    enable(): void {
        this._enable = true;
    }

    disable(): void {
        this._enable = false;
    }
}

export class AddCellEvent extends SettingsSupplicant {

    private _handler: EventMessageHandler;
    private _notebook: Notebook;
    private _notebookState: NotebookState;

    constructor({ notebookState, notebookPanel, handler, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/AddCellEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;
        this._handler = handler;

    }

    event(
        sender: IObservableUndoableList<ICellModel>,
        args: IObservableList.IChangedArgs<ICellModel>) {

        if (args.type == "add") {

            let cells = [{ id: args.newValues[0].id, index: args.newIndex }];

            this._handler.message({
                ...{
                    event_name: "add_cell",
                    cells: cells
                }, ...this._notebookState.getNotebookState()
            });
        }
    }

    enable(): void {
        this._notebook.model.cells.changed.connect(this.event, this);
    }

    disable(): void {
        this._notebook.model.cells.changed.disconnect(this.event, this);
    }
}


export class RemoveCellEvent extends SettingsSupplicant {

    private _handler: EventMessageHandler;
    private _notebook: Notebook;
    private _notebookState: NotebookState;

    constructor({ notebookState, notebookPanel, handler, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/RemoveCellEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;
        this._handler = handler;
    }

    event(
        sender: IObservableUndoableList<ICellModel>,
        args: IObservableList.IChangedArgs<ICellModel>) {

        if (args.type == "remove") {

            let cells = [{ id: args.oldValues[0].id, index: args.oldIndex }];

            this._handler.message({
                ...{
                    event_name: "remove_cell",
                    cells: cells
                }, ...this._notebookState.getNotebookState()
            });
        }
    }

    enable(): void {
        this._notebook.model.cells.changed.connect(this.event, this);
    }

    disable(): void {
        this._notebook.model.cells.changed.disconnect(this.event, this);
    }
}