import { ITelemetry } from '../common/telemetry';
import { MondaySDK, Item, Tag } from 'monday-sdk-js';
import { BoardsManager } from './boardsManager';
import Logger from '../common/logger';
import { UsersManager } from './usersManager';

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
        private readonly boardsManager: BoardsManager,
        private readonly usersManager: UsersManager,
    ) {}

    async init(): Promise<Required<void>> {
        Logger.appendLine('Init ItemsManager');

        this._telemetry.sendTelemetryEvent('tasks.manager.init');

        this._telemetry.sendTelemetryEvent('tasks.manager.success');
    }

    async getEntries(): Promise<Item[]> {
        return this.sdk.api<ItemResponse>(this.ItemsQuery(), '').then((res) => res.data.items);
    }

    async getItem(id: string): Promise<Item> {
        return this.sdk.api<ItemResponse>(this.ItemsQuery([id]), '').then((res) => res.data.items[0]);
    }

    async getAllTags(): Promise<Tag[]> {
        const boardIds = this.boardsManager.boards.map((board) => board.id);
        return Promise.all([
            this.sdk
                .api<{ boards: { tags: Tag[] }[] }>(this.boardTagsQuery(boardIds), '')
                .then((res) => res.data.boards.reduce((acc, curr) => [...acc, ...curr.tags], [])),
            this.sdk.api<{ tags: Tag[] }>(this.publicTagsQuery(), '').then((res) => res.data.tags),
        ]).then(([boardTags, publicTags]) => [...boardTags, ...publicTags]);
    }

    // TODO: update sync and creation of tags. that's disgusting btw.
    // async updateTags(itemId: string, tags: string[], boardId: string) {
    //     boardId = boardId ? boardId : this.boardsManager.defaultBoard.id;

    // }

    async updateBody(itemId: string, body: string, boardId?: string) {
        boardId = boardId ? boardId : this.boardsManager.defaultBoard.id;
        const query = String.raw`
        mutation {
            change_column_value (board_id: ${Number(boardId)}, item_id: ${Number(
            itemId,
        )}, column_id: "long_text", value: "{\"text\": \"${body}\"}") {
                id
            }
        }`;

        return await this.sdk.api(query, '').then((res) => {
            return res;
        });
    }

    async updateSubscribers(itemId: string, subscribers: string[], boardId?: string) {
        boardId = boardId ? boardId : this.boardsManager.defaultBoard.id;
        const promises: Promise<any>[] = [];

        subscribers.forEach((subscriber) => {
            const user = this.usersManager.findUserByName(subscriber);
            const kind = user?.isTeam ? 'team' : 'person';
            const query = String.raw`
            mutation {
                change_column_value (board_id: ${Number(boardId)}, item_id: ${Number(
                itemId,
            )}, column_id: "person", value: "{\"added_person_or_team\": {\"id\": ${
                user?.id
            }, \"kind\": \"${kind}\"}}") {
                    id
                }
            }`;

            const promise = this.sdk.api(query, '').then((res) => {
                return res;
            });

            promises.push(promise);
        });

        return await Promise.all(promises).then((res) => {
            return res;
        });
    }

    async createItem(title: string, boardId?: string, groupId?: string): Promise<Item & { board: { id: string } }> {
        boardId = boardId ? boardId : this.boardsManager.defaultBoard.id;
        groupId = groupId ? groupId : this.boardsManager.defaultBoard.groups[0]?.id;
        return await this.sdk.api<CreateItemResponse>(this.createItemQuery(title, boardId, groupId), '').then((res) => {
            return res.data.create_item;
        });
    }

    private boardTagsQuery(ids: string[]): string {
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
    private createItemQuery(title: string, boardId: string, groupId?: string): string {
        return `mutation {
					create_item (board_id: ${boardId}, ${groupId ? `group_id: ${groupId},` : ``} item_name: "${title}") {
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

    private ItemsQuery(ids?: string[]): string {
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
            board {
                id
            }
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
