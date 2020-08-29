import * as vscode from 'vscode';
import * as PersistentState from '../common/persistentState';
import Logger from '../common/logger';
import { ITelemetry } from '../common/telemetry';
import { MondayKit } from './kit';

const TRY_AGAIN = 'Try again?';
const CANCEL = 'Cancel';
const SIGNIN_COMMAND = 'Sign in';
const IGNORE_COMMAND = "Don't show again";

const PROMPT_FOR_SIGN_IN_SCOPE = 'prompt for sign in';
const PROMPT_FOR_SIGN_IN_STORAGE_KEY = 'login';

export class CredentialStore {
    private _mondayAPI: MondayKit = new MondayKit();

    constructor(private readonly _telemetry: ITelemetry) {}

    public async initialize(): Promise<MondayKit> {
        return this._mondayAPI.init();
    }

    public async reset(): Promise<void> {
        this._mondayAPI?.setSession(undefined);
        await this.initialize();
    }

    public isAuthenticated(): boolean {
        return !!this._mondayAPI.isAuthenticated();
    }

    public getApi(): MondayKit {
        return this._mondayAPI;
    }

    public async getApiOrLogin(): Promise<MondayKit> {
        return this._mondayAPI.isAuthenticated() ? this._mondayAPI : await this.login();
    }

    public async showSignInNotification(): Promise<MondayKit | undefined> {
        if (PersistentState.fetch(PROMPT_FOR_SIGN_IN_SCOPE, PROMPT_FOR_SIGN_IN_STORAGE_KEY) === false) {
            return;
        }

        const result = await vscode.window.showInformationMessage(
            `In order to use the Boards and Items functionality, you must sign in to Monday`,
            SIGNIN_COMMAND,
            IGNORE_COMMAND,
        );

        if (result === SIGNIN_COMMAND) {
            return await this.login();
        } else {
            // user cancelled sign in, remember that and don't ask again
            PersistentState.store(PROMPT_FOR_SIGN_IN_SCOPE, PROMPT_FOR_SIGN_IN_STORAGE_KEY, false);

            /* __GDPR__
                "auth.cancel" : {}
            */
            this._telemetry.sendTelemetryEvent('auth.cancel');
        }
    }

    public async logout(): Promise<void> {
        this._telemetry.sendTelemetryEvent('auth.signout');
        this._mondayAPI?.setSession();
        vscode.window.showInformationMessage('Monday VS Code Extension - Logged out successfully');
    }

    public async login(): Promise<MondayKit> {
        /* __GDPR__
            "auth.start" : {}
        */
        const projectUri = vscode.workspace.workspaceFolders?.[0].uri.fsPath
        this._telemetry.sendTelemetryEvent('auth.start');

        let retry = true;
        while (retry) {
            try {
                await this._mondayAPI.login();
            } catch (e) {
                Logger.appendLine(`Error signing in to Monday: ${e}`);
                if (e instanceof Error && e.stack) {
                    Logger.appendLine(e.stack);
                }
            }

            if (this._mondayAPI.isAuthenticated()) {
                retry = false;
            } else {
                retry =
                    (await vscode.window.showErrorMessage(`Error signing in to Monday`, TRY_AGAIN, CANCEL)) ===
                    TRY_AGAIN;
            }
        }

        if (this._mondayAPI.isAuthenticated()) {
            /* __GDPR__
                "auth.success" : {}
            */
            this._telemetry.sendTelemetryEvent('auth.success');
            vscode.window.showInformationMessage('Monday VS Code Extension - Logged in successfully');
        } else {
            /* __GDPR__
                "auth.fail" : {}
            */
            this._telemetry.sendTelemetryEvent('auth.fail');
            vscode.window.showInformationMessage('Monday VS Code Extension - Login failed!');
        }

        return this._mondayAPI;
    }
}
