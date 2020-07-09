import { ApolloClient, InMemoryCache, NormalizedCacheObject } from 'apollo-boost';
import { setContext } from 'apollo-link-context';
import * as vscode from 'vscode';
import Logger from '../common/logger';
import * as PersistentState from '../common/persistentState';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'node-fetch';
import { ITelemetry } from '../common/telemetry';
import { MondayKit, MondaySession } from './kit';

const TRY_AGAIN = 'Try again?';
const CANCEL = 'Cancel';
const SIGNIN_COMMAND = 'Sign in';
const IGNORE_COMMAND = 'Don\'t show again';

const PROMPT_FOR_SIGN_IN_SCOPE = 'prompt for sign in';
const PROMPT_FOR_SIGN_IN_STORAGE_KEY = 'login';

// TODO: figure out how to implement the ProvidersAPI https://github.com/microsoft/vscode/issues/88309
// const AUTH_PROVIDER_ID = 'monday';

export interface Monday {
	mondayKit: MondayKit;
	graphql: ApolloClient<NormalizedCacheObject>;
}

export class CredentialStore {
	private _mondayAPI: Monday | undefined;
	private _sessionId: string | undefined;

	constructor(private readonly _telemetry: ITelemetry) { }

	public async initialize(): Promise<void> {
		// TODO: figure out how to implement the ProvidersAPI https://github.com/microsoft/vscode/issues/88309
		// const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, SCOPES, { createIfNone: false });
		const session = (PersistentState.fetch('monday', 'session')) as MondaySession;

		if (session?.access_token) {
			this._mondayAPI = new MondayKit(session?.access_token) as any;
		} else {
			Logger.debug(`No token found.`, 'Authentication');
		}
	}

	public async reset() {
		this._mondayAPI = undefined;
		await this.initialize();
	}

	public isAuthenticated(): boolean {
		return !!this._mondayAPI;
	}

	public getApi(): Monday | undefined {
		return this._mondayAPI;
	}

	public async getApiOrLogin(): Promise<Monday | undefined> {
		return this._mondayAPI ?? await this.login();
	}

	public async showSignInNotification(): Promise<Monday | undefined> {
		if (PersistentState.fetch(PROMPT_FOR_SIGN_IN_SCOPE, PROMPT_FOR_SIGN_IN_STORAGE_KEY) === false) {
			return;
		}

		const result = await vscode.window.showInformationMessage(
			`In order to use the Boards and Items functionality, you must sign in to Monday`,
			SIGNIN_COMMAND, IGNORE_COMMAND);

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
		if (this._sessionId) {
			vscode.authentication.logout('github', this._sessionId);
		}
	}

	public async login(): Promise<Monday | undefined> {

		/* __GDPR__
			"auth.start" : {}
		*/
		this._telemetry.sendTelemetryEvent('auth.start');

		let retry: boolean = true;
		let monday: Monday | undefined = undefined;

		while (retry) {
			try {
				const token = await this.getSessionOrLogin();
				monday = await this.createApi(token);
			} catch (e) {
				Logger.appendLine(`Error signing in to MondayKit: ${e}`);
				if (e instanceof Error && e.stack) {
					Logger.appendLine(e.stack);
				}
			}

			if (monday) {
				retry = false;
			} else {
				retry = (await vscode.window.showErrorMessage(`Error signing in to MondayKit`, TRY_AGAIN, CANCEL)) === TRY_AGAIN;
			}
		}

		if (monday) {
			this._mondayAPI = monday;

			/* __GDPR__
				"auth.success" : {}
			*/
			this._telemetry.sendTelemetryEvent('auth.success');
		} else {
			/* __GDPR__
				"auth.fail" : {}
			*/
			this._telemetry.sendTelemetryEvent('auth.fail');
		}

		return monday;
	}

	private async getSessionOrLogin(): Promise<string> {
		const session = PersistentState.fetch('monday', 'session') as MondaySession;
		return session.access_token;
	}

	private async createApi(token: string): Promise<Monday> {
		const mondayKit = new MondayKit(token);

		const graphql = new ApolloClient({
			link: link('https://api.monday.com/v2', token || ''),
			cache: new InMemoryCache,
			defaultOptions: {
				query: {
					fetchPolicy: 'no-cache'
				}
			}
		});

		return {
			mondayKit,
			graphql
		};
	}
}

const link = (url: string, token: string) =>
	setContext((_, { headers }) => (({
		headers: {
			...headers,
			authorization: token ? `Bearer ${token}` : '',
			Accept: 'application/json'
		}
	}))).concat(createHttpLink({
		uri: `${url}/graphql`,
		// https://github.com/apollographql/apollo-link/issues/513
		fetch: fetch as any
	}));