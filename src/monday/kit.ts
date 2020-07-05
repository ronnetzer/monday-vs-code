import * as http from 'http';
import * as querystring from 'querystring';
import * as PersistentState from '../common/persistentState';
import * as vscode from 'vscode';
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
// const TOKEN_URI = 'https://auth.monday.com/oauth2/token';

// https://auth.monday.com/oauth2/authorize?client_id=ed8c61ed38205f088d7a499d63a52f56&redirect_uri=http://localhost:3000/oauth/callback&scope=me:read%20boards:read%20boards:write%20notifications:write%20teams:read

export class MondayKit {

	private _redirectUriInstance: http.Server | undefined;
	// private _token: string;

	constructor(token: string) {
		// TODO: check if token expired, if it is get from the PersistantState the refresh token and try to refresh,
		// if failed as well. return null instead of the instance or logout.

		if (!token) {
			this.login();
		} else if (this.isExpired(token)) {
			// check if token expired and handle refresh
			this.refreshToken();
		} else {
			// this._token = token;
			PersistentState.store('monday', 'token', token);
		}
	}

	private login() {

		//create a server object
		this._redirectUriInstance = http.createServer((req, res) => {
			res.writeHead(200, { 'Content-Type': 'text/html' }); // http header
			const { url, method } = req;
			if (method === 'GET' && url?.includes('/oauth/callback')) {
				const params = querystring.parse(url);
				res.end('Success');
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

	private shutdownRedirectServer() {
		this._redirectUriInstance?.close();
		this._redirectUriInstance = undefined;
		Logger.appendLine('Redirect uri server instance shutdown', 'monday kit');
	}

	private isExpired(token: string) {
		return true;
	}

	private refreshToken() {
		const refreshToken = PersistentState.fetch('monday', 'refresh_token');

		if (!refreshToken) {
			// TODO: reinitiate login
		}

		// TODO: start refresh flow.
	}

}