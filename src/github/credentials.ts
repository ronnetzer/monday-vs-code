/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Octokit } from '@octokit/rest';
import { ApolloClient, InMemoryCache, NormalizedCacheObject } from 'apollo-boost';
import { setContext } from 'apollo-link-context';
import * as vscode from 'vscode';
import { agent } from '../common/net';
import Logger from '../common/logger';
import * as PersistentState from '../common/persistentState';
import { createHttpLink } from 'apollo-link-http';
import fetch from 'node-fetch';
import { ITelemetry } from '../common/telemetry';

const TRY_AGAIN = 'Try again?';
const CANCEL = 'Cancel';
const SIGNIN_COMMAND = 'Sign in';
const IGNORE_COMMAND = 'Don\'t show again';

const PROMPT_FOR_SIGN_IN_SCOPE = 'prompt for sign in';
const PROMPT_FOR_SIGN_IN_STORAGE_KEY = 'login';

const AUTH_PROVIDER_ID = 'github';
const SCOPES = ['read:user', 'user:email', 'repo'];

export interface AnnotatedOctokit extends Octokit {
	currentUser?: Octokit.PullsGetResponseUser;
}

export interface GitHub {
	octokit: AnnotatedOctokit;
	graphql: ApolloClient<NormalizedCacheObject> | null;
}

export class CredentialStore {
	private _githubAPI: GitHub | undefined;
	private _sessionId: string | undefined;

	constructor(private readonly _telemetry: ITelemetry) { }

	public async initialize(): Promise<void> {
		const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, SCOPES, { createIfNone: false });

		if (session) {
			const token = session.accessToken;
			this._sessionId = session.id;
			const octokit = await this.createHub(token);
			this._githubAPI = octokit;
			await this.setCurrentUser(octokit.octokit);
		} else {
			Logger.debug(`No token found.`, 'Authentication');
		}
	}

	public async reset() {
		this._githubAPI = undefined;
		await this.initialize();
	}

	public isAuthenticated(): boolean {
		return !!this._githubAPI;
	}

	public getHub(): GitHub | undefined {
		return this._githubAPI;
	}

	public async getHubOrLogin(): Promise<GitHub | undefined> {
		return this._githubAPI ?? await this.login();
	}

	public async showSignInNotification(): Promise<GitHub | undefined> {
		if (PersistentState.fetch(PROMPT_FOR_SIGN_IN_SCOPE, PROMPT_FOR_SIGN_IN_STORAGE_KEY) === false) {
			return;
		}

		const result = await vscode.window.showInformationMessage(
			`In order to use the Pull Requests functionality, you must sign in to GitHub`,
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

	public async login(): Promise<GitHub | undefined> {

		/* __GDPR__
			"auth.start" : {}
		*/
		this._telemetry.sendTelemetryEvent('auth.start');

		let retry: boolean = true;
		let octokit: GitHub | undefined = undefined;

		while (retry) {
			try {
				const token = await this.getSessionOrLogin();
				octokit = await this.createHub(token);
			} catch (e) {
				Logger.appendLine(`Error signing in to GitHub: ${e}`);
				if (e instanceof Error && e.stack) {
					Logger.appendLine(e.stack);
				}
			}

			if (octokit) {
				retry = false;
			} else {
				retry = (await vscode.window.showErrorMessage(`Error signing in to GitHub`, TRY_AGAIN, CANCEL)) === TRY_AGAIN;
			}
		}

		if (octokit) {
			this._githubAPI = octokit;
			await this.setCurrentUser(octokit.octokit);

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

		return octokit;
	}

	public isCurrentUser(username: string): boolean {
		return this._githubAPI?.octokit?.currentUser?.login === username;
	}

	public getCurrentUser(): Octokit.PullsGetResponseUser {
		const octokit = this._githubAPI?.octokit;
		// TODO remove cast
		return octokit && (octokit as any).currentUser;
	}

	private async setCurrentUser(octokit: AnnotatedOctokit): Promise<void> {
		const user = await octokit.users.getAuthenticated({});
		octokit.currentUser = user.data;
	}

	private async getSessionOrLogin(): Promise<string> {
		const session = await vscode.authentication.getSession(AUTH_PROVIDER_ID, SCOPES, { createIfNone: true });
		this._sessionId = session.id;
		return session.accessToken;
	}

	private async createHub(token: string): Promise<GitHub> {
		const octokit = new Octokit({
			request: { agent },
			userAgent: 'GitHub VSCode Pull Requests',
			// `shadow-cat-preview` is required for Draft PR API access -- https://developer.github.com/v3/previews/#draft-pull-requests
			previews: ['shadow-cat-preview'],
			auth() {
				return `token ${token || ''}`;
			}
		});

		const graphql = new ApolloClient({
			link: link('https://api.github.com', token || ''),
			cache: new InMemoryCache,
			defaultOptions: {
				query: {
					fetchPolicy: 'no-cache'
				}
			}
		});

		return {
			octokit,
			graphql
		};
	}
}

const link = (url: string, token: string) =>
	setContext((_, { headers }) => (({
		headers: {
			...headers,
			authorization: token ? `Bearer ${token}` : '',
			Accept: 'application/vnd.github.shadow-cat-preview+json'
		}
	}))).concat(createHttpLink({
		uri: `${url}/graphql`,
		// https://github.com/apollographql/apollo-link/issues/513
		fetch: fetch as any
	}));