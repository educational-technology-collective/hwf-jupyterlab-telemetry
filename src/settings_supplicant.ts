
import { ISettingRegistry } from "@jupyterlab/settingregistry";

type ISetting = {
    [key: string]: {
        enable: boolean;
    };
}

export abstract class SettingsSupplicant {

    private _key: string;
    private _URN: string;

    constructor({ settings, key, URN }: { settings: ISettingRegistry.ISettings, key: string, URN: string }) {
        this._key = key;
        this._URN = URN;

        let state = new WeakMap<SettingsSupplicant, boolean>();

        state.set(this, false);

        function fn(this: SettingsSupplicant, settings: ISettingRegistry.ISettings, _: void) {

            try {

                if ((settings.get(this._key).composite as ISetting)[this._URN]?.enable) {

                    if (state.get(this) === false) {
                        this.enable();
                        state.set(this, true);
                    }
                }
                else {
                    if (state.get(this) === true) {
                        this.disable();
                        state.set(this, false);
                    }
                }
            }
            catch (e) {
                console.error(e);
                this.disable();
                state.set(this, false);
            }
        }

        settings.changed.connect(fn, this);

        setTimeout(fn.bind(this, settings));
    }

    protected abstract enable(): void;
    protected abstract disable(): void;
}