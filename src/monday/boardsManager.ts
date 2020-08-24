import * as WorkspaceState from '../common/workspaceState';
import * as vscode from 'vscode';
import { ITelemetry } from '../common/telemetry';
import { MondaySDK, Board, Group } from 'monday-sdk-js';
import Logger from '../common/logger';

export interface BoardsResponse {
    boards: Board[];
}

export interface GroupsResponse {
    boards: { groups: Group[] }[];
}

export class BoardsManager {
    boards: Board[];
    defaultBoard: Board;
    constructor(private readonly _telemetry: ITelemetry, private readonly _mondaySDK: MondaySDK) {}

    async init(): Promise<Board> {
        Logger.appendLine('Init BoardsManager');
        // TODO: load from api all possible boards, check the state to see if the default board is defined.
        this._telemetry.sendTelemetryEvent('boards.manager.init');
        this.setDefaultBoard(WorkspaceState.fetch('monday', 'defaultBoard') as Board);

        await this.getEntries();

        // if we have 0 boards, throw an error.
        if (this.boards.length <= 0) {
            this._telemetry.sendTelemetryEvent('boards.manager.fail');
            throw new Error('No boards found, go and open some');
        }

        // if we have defaultBoard, check if he exists in the boards list.
        // otherwise prompt the user to select his default board
        // TODO: support multiple boards in a single project/workspace.
        if (
            !this.defaultBoard ||
            !this.defaultBoard.id ||
            !this.boards.find((board) => board.id === this.defaultBoard.id)
        ) {
            await this.selectDefaultBoard();
        }

        this._telemetry.sendTelemetryEvent('boards.manager.success');

        return this.defaultBoard;
    }

    public async getEntries(): Promise<void> {
        Logger.appendLine('Fetching boards');
        const boardsQuery = this.allBoardsQuery();
        const boardsResponse = await this._mondaySDK.api<BoardsResponse>(boardsQuery, '');
        this.boards = boardsResponse.data.boards;
    }

    public async selectDefaultBoard(): Promise<void> {
        const choices = this.getBoardsChoices();
        const response: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(choices, {
            placeHolder: 'Default monday board for this workspace',
        });
        if (response) {
            this.setDefaultBoard(this.boards.find((board) => `${board.id}` === response.description) as Board);
        } else {
            this._telemetry.sendTelemetryEvent('boards.manager.fail');
            throw new Error('No default board selected');
        }
    }

    public async getBoardGroups(boardId: string): Promise<Group[]> {
        const response = await this._mondaySDK.api<GroupsResponse>(this.allBoardGroups(boardId), '');
        return response.data.boards[0].groups;
    }

    public setDefaultBoard(board: Board): void {
        this.defaultBoard = board;
        WorkspaceState.store('monday', 'defaultBoard', this.defaultBoard);
    }

    private allBoardsQuery() {
        return `{
			boards() {
			name,
			id,
            state,
            groups {
                id
            },
			tags {
			    id,
                name,
                color
			},
			board_kind
		  }
		}`;
    }

    private allBoardGroups(boardId: string) {
        return `{
			boards(ids: ${boardId}) {
				groups {
					id
					title
					deleted
					archived
					color
					position
					items {
						id
						name
					}
				}
			}
		}`;
    }

    private getBoardsChoices(): vscode.QuickPickItem[] {
        return this.boards.map((board) => ({ label: board.name, alwaysShow: true, description: `${board.id}` }));
    }
}
