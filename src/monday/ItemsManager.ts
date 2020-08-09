import { ITelemetry } from '../common/telemetry';
import { MondaySDK, Item, Tag, UserPreview, Board } from 'monday-sdk-js';
import { BoardsManager } from './boardsManager';
import Logger from '../common/logger';

export interface ItemResponse<T = Item> {
	items: T[];
}

export interface CreateItemResponse {
	create_item: Item & { board: { id: string } };
}

export class ItemsManager {
	constructor(
		private readonly _telemetry: ITelemetry,
		private readonly sdk: MondaySDK,
		private readonly boardsManager: BoardsManager
	) { }

	async init(): Promise<Required<void>> {
		Logger.appendLine('Init ItemsManager');

		this._telemetry.sendTelemetryEvent('tasks.manager.init');

		this._telemetry.sendTelemetryEvent('tasks.manager.success');
	}

	async getEntries(): Promise<Item[]> {
		return this.sdk.api<ItemResponse>(this.ItemsQuery(), '').then(res => res.data.items);
	}

	async getItem(id: number): Promise<Item> {
		return this.sdk.api<ItemResponse>(this.ItemsQuery([id]), '').then(res => res.data.items[0]);
	}

	async getAllTags(): Promise<Tag[]> {
		const boardIds = this.boardsManager.boards.map(board => board.id);
		return Promise.all([
			this.sdk.api<{ boards: { tags: Tag[] }[] }>(this.boardTagsQuery(boardIds), '').then(res => res.data.boards.reduce((acc, curr) => [...acc, ...curr.tags], [])),
			this.sdk.api<{ tags: Tag[] }>(this.publicTagsQuery(), '').then(res => res.data.tags)
		]).then(([boardTags, publicTags]) => [...boardTags, ...publicTags]);
	}

	async createItem(title: string, board?: Board): Promise<Item & { board: { id: string } }> {
		const boardId = board ? board.id : this.boardsManager.defaultBoard.id;
		return await this.sdk.api<CreateItemResponse>(this.createItemQuery(boardId, title), '').then(res => {
			return res.data.create_item;
		});
	}

	private boardTagsQuery(ids: number[]): string {
		return `{
			boards(ids: [${ids.join(', ')}]) ${this.publicTagsQuery()}
		}`;
	}

	private publicTagsQuery(): string {
		return `{
			tags {
				id
				name
				color
			}
		}`;
	}

	/**
	 *
	 * @returns newly created item id
	 */
	private createItemQuery(boardId: number, title: string): string {
		return `mutation {
					create_item (board_id: ${boardId}, item_name: "${title}") {
						id,
						subscribers { id },
						name,
						creator_id
						created_at
						updated_at
						group {
							id
						}
						board {
							id
						}
					}
				}`;
	}

	private ItemsQuery(ids?: number[]): string {
		return `{
			items ${ids ? `(ids: [${ids.join(', ')}])` : ``} {
				${this.itemsModelQuery()}
			}
		}`;
	}

	private itemsModelQuery(): string {
		return `
			id
			name
			state
			creator_id
			created_at
			updated_at
			group {
				id
				title
				position
				color
				deleted
				archived
			}
			subscribers {
				id
				name
				email
			}
		`;
	}
}