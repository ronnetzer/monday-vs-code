import { ITelemetry } from '../common/telemetry';
import { MondaySDK } from 'monday-sdk-js';
import { MondaySDKResponse } from './kit';

export interface User {
	id: number;
	name: string;
	photo_thumb_small: string;
	title: string;
	url: string;
}

export interface Users {
	users: User[];
}

export class UsersManager {
	users: User[];
	constructor(private readonly _telemetry: ITelemetry, private readonly _mondaySDK: MondaySDK) { }

	async init(): Promise<void> {
		// TODO: load from api all possible boards, check the state to see if the default board is defined.
		this._telemetry.sendTelemetryEvent('users.manager.init');

		const boardsQuery = this.allNonGuestUsersQuery();

		const usersResponse = await this._mondaySDK.api(boardsQuery, '') as MondaySDKResponse<Users>;
		this.users = usersResponse.data.users;

		// if we have 0 boards, throw an error.
		if (this.users.length <= 0) {
			this._telemetry.sendTelemetryEvent('users.manager.fail');
			throw new Error('No users found, something is fishy here');
		}

		this._telemetry.sendTelemetryEvent('users.manager.success');
	}

	private allNonGuestUsersQuery() {
		return `{
			users(kind: non_guests) {
				id
				name
				photo_thumb_small
				title
				url
			}
		}`;
	}
}