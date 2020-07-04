/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RemoteSourceProvider, RemoteSource } from './typings/git';
import { CredentialStore, GitHub } from './github/credentials';
import { Octokit } from '@octokit/rest';

function asRemoteSource(raw: Octokit.SearchReposResponseItemsItem): RemoteSource {
	return {
		name: `$(github) ${raw.full_name}`,
		description: raw.description || undefined,
		url: `${raw.html_url}.git`
	};
}

export class GithubRemoteSourceProvider implements RemoteSourceProvider {

	readonly name = 'GitHub';
	readonly icon = 'github';
	readonly supportsQuery = true;

	private userReposCache: RemoteSource[] = [];

	constructor(private readonly credentialStore: CredentialStore) { }

	async getRemoteSources(query?: string): Promise<RemoteSource[]> {
		const hub = await this.credentialStore.getHubOrLogin();

		if (!hub) {
			throw new Error('Could not fetch repositories from GitHub.');
		}

		const [fromUser, fromQuery] = await Promise.all([
			this.getUserRemoteSources(hub, query),
			this.getQueryRemoteSources(hub, query)
		]);

		const userRepos = new Set(fromUser.map(r => r.name));

		return [
			...fromUser,
			...fromQuery.filter(r => !userRepos.has(r.name))
		];
	}

	private async getUserRemoteSources(hub: GitHub, query?: string): Promise<RemoteSource[]> {
		if (!query) {
			const res = await hub.octokit.repos.list({ sort: 'pushed', per_page: 100 });
			this.userReposCache = res.data.map(asRemoteSource);
		}

		return this.userReposCache;
	}

	private async getQueryRemoteSources(hub: GitHub, query?: string): Promise<RemoteSource[]> {
		if (!query) {
			return [];
		}

		const raw = await hub.octokit.search.repos({ q: query, sort: 'updated' });
		return raw.data.items.map(asRemoteSource);
	}
}