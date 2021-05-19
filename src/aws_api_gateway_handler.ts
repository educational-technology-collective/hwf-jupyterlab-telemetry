import { IHandler } from './types';

import { ISettingRegistry } from "@jupyterlab/settingregistry";
import { SettingsSupplicant } from "./settings_supplicant";

import {
    requestAPI
} from "./handler";

interface IAWSAPIGatewayHandlerOptions {
    settings: ISettingRegistry.ISettings;
    url: string;
    bucket: string;
    path: string;
}

export class AWSAPIGatewayHandler extends SettingsSupplicant implements IHandler {

    private _url: string;
    private _bucket: string;
    private _path: string;
    protected _enable: boolean;

    public static URN = "mentoracademy.org/handlers/AWSAPIGatewayHandler";

    constructor({ settings, url, bucket, path }: IAWSAPIGatewayHandlerOptions) {
        super({
            settings,
            key: "handler",
            URN: AWSAPIGatewayHandler.URN
        });

        this._url = url;
        this._bucket = bucket;
        this._path = path;

        this.handle = this.handle.bind(this);
    }

    async handle(message: any): Promise<Response> {

        let response: Response;

        try {

            if (!this._enable)
                return;

            let path = [this._url, this._bucket, this._path].join("/");

            response = await fetch(path, {
                method: "POST",
                mode: "cors",
                cache: "no-cache",
                headers: {
                    "Content-Type": "application/json"
                },
                redirect: "follow",
                referrerPolicy: "no-referrer",
                body: JSON.stringify({ data: message })
            });

            if (response.status !== 200) {

                throw new Error(JSON.stringify({
                    "response.status": response.status,
                    "response.statusText": response.statusText,
                    "response.text()": await response.text()
                }));
            }

            message.aws_response = await response.json()

            let epochTime = message.aws_response.context["request-time-epoch"];
            let uuid = message.aws_response.context["request-id"];
            
            message.path = [path, epochTime, uuid].join("/");

            console.log("JL Server Request: ", message);

            let res = await requestAPI<any>('event', { method: 'POST', body: JSON.stringify(message) });

            console.log("JL Server Response: ", res)
        }
        catch (e) {

            console.error(e);
            setTimeout(this.handle, 1000, message);
        }

        return response;
    }

    enable(): void {
        this._enable = true;
    }

    disable(): void {
        this._enable = false;
    }
}
