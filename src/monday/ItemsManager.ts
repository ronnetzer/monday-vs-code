import { ITelemetry } from '../common/telemetry';
import { MondaySDK, Item, Tag } from 'monday-sdk-js';
import { BoardsManager } from './boardsManager';
import Logger from '../common/logger';

export interface ItemResponse<T = Item> {
	items: T[];
}

export class ItemsManager {
	constructor(
		private readonly _telemetry: ITelemetry,
		private readonly sdk: MondaySDK,
		private readonly boardsManager: BoardsManager
	) {}

	async init(): Promise<Required<void>> {
		Logger.appendLine('Init ItemsManager');

		this._telemetry.sendTelemetryEvent('tasks.manager.init');

		this._telemetry.sendTelemetryEvent('tasks.manager.success');
	}

	async getEntries(): Promise<Item[]> {
		return await this.sdk.api<ItemResponse>(this.ItemsQuery(), '').then(res => res.data.items);
	}

	async getAllTags(): Promise<Tag[]> {
		const boardIds = this.boardsManager.boards.map(board => board.id);
		return Promise.all([
			this.sdk.api<{ boards: { tags: Tag[]}[] }>(this.boardTagsQuery(boardIds), '').then(res => res.data.boards.reduce((acc, curr) => [ ...acc, ...curr.tags], [])),
			this.sdk.api<{ tags: Tag[] }>(this.publicTagsQuery(), '').then(res => res.data.tags)
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

	ItemsQuery(): string {
		return `{
			items {
				id
				name
				color
				creator_id
				created_at
				updated_at
				group {
					id
					name
					deleted
					archived
				}
				subscribers {
					id
					name
					email
				}
			}
		}`;
	}
}