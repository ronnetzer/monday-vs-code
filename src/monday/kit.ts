import * as http from 'http';
import * as PersistentState from '../common/persistentState';
import * as vscode from 'vscode';
import * as fetch from 'node-fetch';
import * as mondaySdk from 'monday-sdk-js';
import { parse } from 'url';
import Logger from '../common/logger';

// access_token	An access token that can be used to make calls to the monday.com API. It is valid for 30 days.
// token_type	Bearer -- all monday OAuth tokens are bearer token.
// scope	A space-separated list of scopes that have been granted for this access token.
// expires_in	The time period (in seconds) for which the access token is valid.
// refresh_token	A token that can be used to obtain a new access_token when it expires. To learn more, read the next section.
export interface MondaySession {
    access_token: string;
    token_type: string;
    scope: string;
    expires_in: string;
    refresh_token: string;
    access_token_expiration_date: number;
    refresh_token_expiration_date: number;
}

// TODO: remove those from code into CI.
const CLIENT_ID = 'ed8c61ed38205f088d7a499d63a52f56';
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';
const SCOPES = ['me:read', 'boards:read', 'boards:write', 'notifications:write', 'teams:read', 'users:read'];
const OAUTH_URI = `https://auth.monday.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPES.join(
    '%20',
)}`;
const CLIENT_SECRET = 'c354ecd321c6eda34392fd30de4205e6';
const TOKEN_URI = 'https://auth.monday.com/oauth2/token';

// https://auth.monday.com/oauth2/authorize?client_id=ed8c61ed38205f088d7a499d63a52f56&redirect_uri=http://localhost:3000/oauth/callback&scope=me:read%20boards:read%20boards:write%20notifications:write%20teams:read

export class MondayKit {
    #redirectUriInstance: http.Server | undefined;
    #sdkInstance: mondaySdk.MondaySDK;

    async init(): Promise<MondayKit> {
        // if no access_token or refresh_token is expired. login in from scratch.
        // is_expired_access_token ? is_expired_refresh_token ? login :
        // refresh_token -> update session.
        this.#sdkInstance = mondaySdk();
        const session = this.getSession();

        if (!session || !session.access_token || this.isExpired(session.refresh_token_expiration_date)) {
            this.setSession(undefined);
            await this.login();
        } else if (this.isExpired(session.access_token_expiration_date)) {
            const accessInfo = await this.refreshToken(session.refresh_token);
            this.handleAcquiredToken(accessInfo);
        } else {
            this.setSession(session);
        }

        return this;
    }

    get sdk(): mondaySdk.MondaySDK {
        return this.#sdkInstance;
    }

    public setSession(session?: MondaySession): void {
        if (session) {
            this.sdk?.setToken(session.access_token);
            vscode.window.showInformationMessage('Monday VS Code Extension - Logged In! :D');
        }

        PersistentState.store('monday', 'session', session);
    }

    public getSession(): MondaySession | undefined {
        return PersistentState.fetch<MondaySession>('monday', 'session');
    }

    public isAuthenticated(): boolean {
        const session = this.getSession();
        return !!session && !this.isExpired(session.access_token_expiration_date);
    }

    private async login() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.shutdownRedirectServer();
                reject('Failed to login after 60 sec');
            }, 60000);

            //create a server object
            this.#redirectUriInstance = http
                .createServer(async (req, res) => {
                    res.writeHead(200, { 'Content-Type': 'text/html' }); // http header
                    const { url, method } = req;
                    if (method === 'GET' && url?.includes('/oauth/callback')) {
                        const params = parse(url, true).query;
                        const projectUrl = vscode.workspace.workspaceFolders![0].uri.fsPath;

                        res.end(`
                        <!DOCTYPE html>
                        <html lang="en">

                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Monday VS Code Extension</title>
                        </head>

                        <body>
                            Authenticated Successfully! 🤙 </br>
                            <script>
                            window.onload = function() {
                                window.location.href = "vscode://file/${projectUrl}"
                              };
                            </script>
                        </body>

                        </html>
					    `);

                        const accessInfo = await this.acquireToken(params.code as string);
                        this.handleAcquiredToken(accessInfo);
                        resolve();
                        this.shutdownRedirectServer(timeout);
                    }
                })
                .listen(3000, () => {
                    Logger.appendLine('Redirect uri server instance up and waiting', 'monday kit');
                    vscode.env.openExternal(vscode.Uri.parse(OAUTH_URI));
                });
        });
    }

    private async acquireToken(code: string) {
        const body = {
            code,
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            client_secret: CLIENT_SECRET,
        };

        return fetch(TOKEN_URI, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        }).then((res) => res.json() as Promise<MondaySession>);
    }

    private shutdownRedirectServer(timeout?: any) {
        if (timeout) {
            clearTimeout(timeout);
        }

        this.#redirectUriInstance?.close();
        this.#redirectUriInstance = undefined;
        Logger.appendLine('Redirect uri server instance shutdown', 'monday kit');
    }

    private isExpired(expirationDate: number) {
        return Date.now() <= expirationDate;
    }

    private async refreshToken(refreshToken: string): Promise<MondaySession> {
        const body = {
            refresh_token: refreshToken,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        };

        return fetch(TOKEN_URI, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
        }).then((res) => res.json() as Promise<MondaySession>);
    }

    private handleAcquiredToken(session: MondaySession) {
        try {
            // if we got refresh token meaning this is inital login and we need
            // to calculate expiration dates both for access_token and refresh_token

            this.sdk?.setToken(session.access_token);
            const currSession = this.getSession();
            let newSessionState = { ...currSession, ...session };

            if (session.refresh_token) {
                let now = new Date();
                const access_token_expiration_date = now.setDate(now.getDate() + 30);
                now = new Date();
                const refresh_token_expiration_date = now.setDate(now.getDate() + 90);
                newSessionState = { ...newSessionState, access_token_expiration_date, refresh_token_expiration_date };
            }

            this.setSession(newSessionState);
        } catch (error) {
            console.error(error);
        }
    }
}
