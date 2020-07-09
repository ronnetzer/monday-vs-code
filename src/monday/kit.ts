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
	expires_in: number;
	refresh_token: string;
}

// TODO: remove those from code into CI.
const CLIENT_ID = 'ed8c61ed38205f088d7a499d63a52f56';
const REDIRECT_URI = 'http://localhost:3000/oauth/callback';
const SCOPES = ['me:read', 'boards:read', 'boards:write', 'notifications:write', 'teams:read'];
const OAUTH_URI = `https://auth.monday.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPES.join('%20')}`;
const CLIENT_SECRET = 'c354ecd321c6eda34392fd30de4205e6';
const TOKEN_URI = 'https://auth.monday.com/oauth2/token';

// https://auth.monday.com/oauth2/authorize?client_id=ed8c61ed38205f088d7a499d63a52f56&redirect_uri=http://localhost:3000/oauth/callback&scope=me:read%20boards:read%20boards:write%20notifications:write%20teams:read

export class MondayKit {

	private _redirectUriInstance: http.Server | undefined;
	private _sdkInstance: mondaySdk.MondaySDK;

	constructor() {
		// TODO: check if token expired, if it is get from the PersistantState the refresh token and try to refresh,
		// if failed as well. return null instead of the instance or logout.

		this._sdkInstance = mondaySdk();
		const expiresIn = PersistentState.fetch('monday', 'expires_in');
		const refreshToken = PersistentState.fetch('monday', 'refresh_token');
		const accessToken = PersistentState.fetch('monday', 'access_token');

		if (!token && !accessToken) {
			this.login();
		} else if (this.isExpired(token)) {
			// check if token expired and handle refresh
			this.refreshToken();
		} else {
			// this._token = token;
			PersistentState.store('monday', 'token', token);
			this._sdkInstance.setToken(token);
		}
	}

	private login() {
		//create a server object
		this._redirectUriInstance = http.createServer((req, res) => {
			res.writeHead(200, { 'Content-Type': 'text/html' }); // http header
			const { url, method } = req;
			if (method === 'GET' && url?.includes('/oauth/callback')) {
				const params = parse(url, true).query;

				// TODO: create a proper auth success page?
				res.end(`
					Successful Authentication! </br>
					Go back to your IDE and start creating items from your VSC :D
				`);

				this.acquireToken(params.code as string);

				this.shutdownRedirectServer();
			}
		}).listen(3000, () => {
			Logger.appendLine('Redirect uri server instance up and waiting', 'monday kit');
			vscode.env.openExternal(vscode.Uri.parse(OAUTH_URI));
		});

		setTimeout(() => {
			this.shutdownRedirectServer();
		}, 60000);
	}

	private acquireToken(code: string) {
		const body = {
			code,
			client_id: CLIENT_ID,
			redirect_uri: REDIRECT_URI,
			client_secret: CLIENT_SECRET
		};

		fetch(TOKEN_URI, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }, })
			.then(res => res.json())
			.then((accessInfo: { access_token: string, token_type: 'Bearer', scope: string, expires_in: string, refresh_token: string }) => {
				this.handleAcquiredToken(accessInfo.access_token, accessInfo.refresh_token, accessInfo.expires_in);
			});
	}

	private shutdownRedirectServer() {
		this._redirectUriInstance?.close();
		this._redirectUriInstance = undefined;
		Logger.appendLine('Redirect uri server instance shutdown', 'monday kit');
	}

	private isExpired(refreshToken: string) {
		// TODO: implement expired token validation.
		return false;
	}

	private refreshToken() {
		const refreshToken = PersistentState.fetch('monday', 'refresh_token');

		if (!refreshToken) {
			// TODO: reinitiate login
		}

		// TODO: start refresh flow.
	}

	private handleAcquiredToken(accessToken: string, refreshToken?: string, expiresIn?: string) {
		try {
			this._sdkInstance.setToken(accessToken);

			PersistentState.store('monday', 'access_token', accessToken);

			if (refreshToken) {
				PersistentState.store('monday', 'refresh_token', refreshToken);
			}

			if (expiresIn) {
				PersistentState.store('monday', 'expires_in', expiresIn);
			}
		} catch (error) {
			console.error(error);
		}

	}

}