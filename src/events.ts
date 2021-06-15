import {
    NotebookPanel,
    INotebookModel,
    Notebook,
    NotebookActions
} from "@jupyterlab/notebook";

import { ISignal, Signal } from '@lumino/signaling';

import {
    Cell,
    ICellModel
} from "@jupyterlab/cells";

import {
    IObservableList,
    IObservableUndoableList
} from "@jupyterlab/observables";

import {
    DocumentRegistry
} from "@jupyterlab/docregistry";

import { NotebookState } from "./index"
import { ISettingRegistry } from "@jupyterlab/settingregistry";
import { SettingsSupplicant } from "./settings_supplicant";

export interface ICellMeta {
    index: number;
    id: any;
}

interface INotebookEventOptions {
    notebookState: NotebookState;
    notebookPanel: NotebookPanel;
    settings: ISettingRegistry.ISettings;
}

export class NotebookSaveEvent extends SettingsSupplicant {

    private _notebookSaved: Signal<NotebookSaveEvent, any> = new Signal(this);
    private _notebookPanel: NotebookPanel;
    private _notebookState: NotebookState;

    constructor({ notebookState, notebookPanel, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/NotebookSaveEvent"
        });

        this._notebookState = notebookState;
        this._notebookPanel = notebookPanel;

        notebookPanel.disposed.connect(this.dispose, this);
    }

    dispose() {
        Signal.disconnectAll(this);
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

            let notebookState = this._notebookState.getNotebookState();

            this._notebookSaved.emit({
                event_name: "save_notebook",
                cells: cells,
                notebook: notebookState.notebook,
                seq: notebookState.seq
            });
        }
    }

    enable(): void {
        this._notebookPanel.context.saveState.connect(this.event, this);
    }

    disable(): void {
        this._notebookPanel.context.saveState.disconnect(this.event, this);
    }

    get notebookSaved(): ISignal<NotebookSaveEvent, any> {
        return this._notebookSaved
    }
}

export class CellExecutionEvent extends SettingsSupplicant {

    private _cellExecuted: Signal<CellExecutionEvent, any> = new Signal(this);
    private _notebook: Notebook;
    private _notebookState: NotebookState;

    constructor({ notebookState, notebookPanel, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/CellExecutionEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;

        notebookPanel.disposed.connect(this.dispose, this);
    }

    dispose() {
        Signal.disconnectAll(this);
    }

    event(_: any, args: { notebook: Notebook; cell: Cell<ICellModel> }): void {

        if (args.notebook.model === this._notebook.model) {

            let cells = [
                {
                    id: args.cell.model.id,
                    index: this._notebook.widgets.findIndex((value: Cell<ICellModel>) => value == args.cell)
                }
            ]

            let notebookState = this._notebookState.getNotebookState();

            this._cellExecuted.emit({
                event_name: "cell_executed",
                cells: cells,
                notebook: notebookState.notebook,
                seq: notebookState.seq
            });
        }
    }

    enable(): void {
        NotebookActions.executed.connect(this.event, this);
    }

    disable(): void {
        NotebookActions.executed.disconnect(this.event, this);
    }

    get cellExecuted(): ISignal<CellExecutionEvent, any> {
        return this._cellExecuted
    }
}


export class NotebookScrollEvent extends SettingsSupplicant {

    private _notebookScrolled: Signal<NotebookScrollEvent, any> = new Signal(this);
    private _notebook: Notebook;
    private _notebookState: NotebookState;

    private _timeout: number;

    constructor({ notebookState, notebookPanel, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/NotebookScrollEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;

        this.event = this.event.bind(this);

        notebookPanel.disposed.connect(this.dispose, this);
    }

    dispose() {
        Signal.disconnectAll(this);
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

            let notebookState = this._notebookState.getNotebookState();

            this._notebookScrolled.emit({
                event_name: "scroll",
                cells: cells,
                notebook: notebookState.notebook,
                seq: notebookState.seq
            });

        }, 1000);
    }

    enable(): void {
        this._notebook.node.addEventListener("scroll", this.event, false);
    }

    disable(): void {
        this._notebook.node.removeEventListener("scroll", this.event, false);
    }

    get notebookScrolled(): ISignal<NotebookScrollEvent, any> {
        return this._notebookScrolled
    }
}

export class ActiveCellChangeEvent extends SettingsSupplicant {

    private _activeCellChanged: Signal<ActiveCellChangeEvent, any> = new Signal(this);
    private _notebook: Notebook;
    private _notebookState: NotebookState;

    constructor({ notebookState, notebookPanel, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/ActiveCellChangeEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;

        notebookPanel.disposed.connect(this.dispose, this);
    }

    dispose() {
        Signal.disconnectAll(this);
    }

    event(send: Notebook, args: Cell<ICellModel>): void {

        let cells = [
            {
                id: args.model.id,
                index: this._notebook.widgets.findIndex((value: Cell<ICellModel>) => value == args)
            }
        ];

        let notebookState = this._notebookState.getNotebookState();

        this._activeCellChanged.emit({
            event_name: "active_cell_changed",
            cells: cells,
            notebook: notebookState.notebook,
            seq: notebookState.seq
        });
    }

    enable(): void {
        this._notebook.activeCellChanged.connect(this.event, this);
    }

    disable(): void {
        this._notebook.activeCellChanged.disconnect(this.event, this);
    }

    get activeCellChanged(): ISignal<ActiveCellChangeEvent, any> {
        return this._activeCellChanged
    }
}

export class NotebookOpenEvent extends SettingsSupplicant {

    private _notebookOpened: Signal<NotebookOpenEvent, any> = new Signal(this);
    private _notebook: Notebook;
    private _notebookState: NotebookState;
    private _enable: boolean;

    constructor({ notebookState, notebookPanel, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/NotebookOpenEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;

        setTimeout(this.event.bind(this));

        notebookPanel.disposed.connect(this.dispose, this);
    }

    dispose() {
        Signal.disconnectAll(this);
    }

    event(): void {

        if (!this._enable) {
            return;
        }

        let cells = this._notebook.widgets.map((cell: Cell<ICellModel>, index: number) =>
            ({ id: cell.model.id, index: index })
        );

        let notebookState = this._notebookState.getNotebookState();

        this._notebookOpened.emit({
            event_name: "open_notebook",
            cells: cells,
            notebook: notebookState.notebook,
            seq: notebookState.seq
        });
    }

    enable(): void {
        this._enable = true;
    }

    disable(): void {
        this._enable = false;
    }

    get notebookOpened(): ISignal<NotebookOpenEvent, any> {
        return this._notebookOpened
    }
}

export class CellAddEvent extends SettingsSupplicant {

    private _cellAdded: Signal<CellAddEvent, any> = new Signal(this);
    private _notebook: Notebook;
    private _notebookState: NotebookState;

    constructor({ notebookState, notebookPanel, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/CellAddEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;

        notebookPanel.disposed.connect(this.dispose, this);
    }

    dispose() {
        Signal.disconnectAll(this);
    }

    event(
        sender: IObservableUndoableList<ICellModel>,
        args: IObservableList.IChangedArgs<ICellModel>) {

        if (args.type == "add") {

            let cells = [{ id: args.newValues[0].id, index: args.newIndex }];

            let notebookState = this._notebookState.getNotebookState();

            this._cellAdded.emit({
                event_name: "add_cell",
                cells: cells,
                notebook: notebookState.notebook,
                seq: notebookState.seq
            });
        }
    }

    enable(): void {
        this._notebook.model.cells.changed.connect(this.event, this);
    }

    disable(): void {
        this._notebook.model.cells.changed.disconnect(this.event, this);
    }

    get cellAdded(): ISignal<CellAddEvent, any> {
        return this._cellAdded
    }
}


export class CellRemoveEvent extends SettingsSupplicant {

    private _cellRemoved: Signal<CellRemoveEvent, any> = new Signal(this);
    private _notebook: Notebook;
    private _notebookState: NotebookState;

    constructor({ notebookState, notebookPanel, settings }: INotebookEventOptions) {
        super({
            settings,
            key: "event",
            URN: "mentoracademy.org/schemas/events/1.0.0/CellRemoveEvent"
        });

        this._notebookState = notebookState;
        this._notebook = notebookPanel.content;

        notebookPanel.disposed.connect(this.dispose, this);
    }

    dispose() {
        Signal.disconnectAll(this);
    }

    event(
        sender: IObservableUndoableList<ICellModel>,
        args: IObservableList.IChangedArgs<ICellModel>) {

        if (args.type == "remove") {

            let cells = [{ id: args.oldValues[0].id, index: args.oldIndex }];

            let notebookState = this._notebookState.getNotebookState();

            this._cellRemoved.emit({
                event_name: "remove_cell",
                cells: cells,
                notebook: notebookState.notebook,
                seq: notebookState.seq
            });
        }
    }

    enable(): void {
        this._notebook.model.cells.changed.connect(this.event, this);
    }

    disable(): void {
        this._notebook.model.cells.changed.disconnect(this.event, this);
    }

    get cellRemoved(): ISignal<CellRemoveEvent, any> {
        return this._cellRemoved
    }
}