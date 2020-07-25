import { ITelemetry } from '../common/telemetry';
import { MondaySDK } from 'monday-sdk-js';
import { CredentialStore } from './credentials';
import { BoardsManager, Board } from './boardsManager';
import { access } from 'fs';

export interface Tag {
	id: number;
	name: string;
	color: string;
}

export interface Task {
	id: number;
	name: string;
}

export interface TaskResponse<T = Task> {
	tasks: T[];
}

export class ItemsManager {
	private _sdk: MondaySDK;

	constructor(
		private readonly credentialStore: CredentialStore,
		private readonly boardsManager: BoardsManager,
		private readonly _telemetry: ITelemetry
	) {
		this._sdk = this.credentialStore.getApi().sdk;
	}

	async init(): Promise<Required<void>> {
		this._telemetry.sendTelemetryEvent('tasks.manager.init');

		this._telemetry.sendTelemetryEvent('tasks.manager.success');
	}

	async getAllTags(): Promise<Tag[]> {
		const boardIds = this.boardsManager.boards.map(board => board.id);
		return Promise.all([
			this._sdk.api<{ boards: { tags: Tag[]}[] }>(this.boardTagsQuery(boardIds), '').then(res => res.data.boards.reduce((acc, curr) => [ ...acc, ...curr.tags], [])),
			this._sdk.api<{ tags: Tag[] }>(this.publicTagsQuery(), '').then(res => res.data.tags)
		]).then(([boardTags, publicTags]) => [ ...boardTags, ...publicTags]);
	}

	boardTagsQuery(ids: number[]): string {
		return `{
			boards(ids: [${ids.join(', ')}]) ${this.publicTagsQuery()}
		}`;
	}

	publicTagsQuery(): string {
		return `{
			tags {
				id
				name
				color
			}
		}`;
	}
}