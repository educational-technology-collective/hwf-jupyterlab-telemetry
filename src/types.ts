export interface ICellMeta {
    index: number;
    id: any;
}

export interface IHandler {
    handle(msg: any): Promise<any>;
}