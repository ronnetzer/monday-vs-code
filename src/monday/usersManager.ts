import { ITelemetry } from '../common/telemetry';
import { MondaySDK } from 'monday-sdk-js';
import { CredentialStore } from './credentials';
import Logger from '../common/logger';

export interface Team {
	id: number;
	name: string;
	picture_url: string;
}

export interface UserPreview {
	id: number;
	name: string;
	email: string;
	isTeam?: boolean;
}

export interface UserDetails {
	photo_thumb_small?: string;
	join_date?: Date;
	url?: string;
	is_guest?: boolean;
	title?: string;
	location?: string;
	teams?: Team[];
}

export type User =  UserPreview & UserDetails;

export interface UserResponse<T = UserPreview> {
	users: T[];
}

export class UsersManager {
	private _sdk: MondaySDK;
	private _currentUser: Required<User>;

	constructor(private readonly _telemetry: ITelemetry, private readonly credentialStore: CredentialStore) {
		this._sdk = credentialStore.getApi().sdk;
	}

	async init(): Promise<Required<User>> {
		// TODO: load from api all possible boards, check the state to see if the default board is defined.
		this._telemetry.sendTelemetryEvent('users.manager.init');

		if (!this.credentialStore.isAuthenticated()) {
			this._telemetry.sendTelemetryEvent('users.manager.error');
			return Promise.reject(new Error('Unauthorized'));
		}

		this._currentUser = await this.getCurrentUser();
		this._telemetry.sendTelemetryEvent('users.manager.success', { currentUser: this._currentUser.name });

		return this._currentUser;
	}

	get currentUser(): Required<User> {
		return this._currentUser || undefined;
	}

	async getEntries(): Promise<User[]> {
		if (this.credentialStore.isAuthenticated()) {
			return await this._sdk.api<UserResponse>(this.allUsersPreviewQuery(), '').then(res => {
				// if we have 0 boards, throw an error.
				if (!res.data.users.length) {
					Logger.appendLine('No users found');
					this._telemetry.sendTelemetryEvent('users.manager.fail');
					throw new Error('No users found, something is fishy here');
				}

				return res.data.users;
			});
		}

		return Promise.resolve([]);
	}

	async getUserTeams(): Promise<Team[]> {
		if (this.credentialStore.isAuthenticated()) {
			return Promise.resolve(this.currentUser.teams);
		}

		return Promise.resolve([]);
	}

	private async getCurrentUser(): Promise<Required<User>> {
		const currentUserRes = await this._sdk.api<{ me: Required<User> }>(this.currentUserQuery(), '');
		return currentUserRes.data.me;
	}

	async getUserDetails(ids: number[]): Promise<UserDetails> {
		const userDetailsQuery = this.userDetailsQuery(ids);
		const userDetailsRes = await this._sdk.api<UserResponse<UserDetails>>(userDetailsQuery, '');
		const userDetails = userDetailsRes.data.users[0];

		if (!userDetails) {
			Logger.appendLine('Cant get user details');
			this._telemetry.sendTelemetryEvent('users.manager.fail');
			return Promise.reject(new Error('Cant get user details'));
		}

		return userDetails;
	}

	private allUsersPreviewQuery() {
		return `{
			users {
				id
				name
				email
			}
		}`;
	}

	private currentUserQuery() {
		return `{
			me {
				id
				name
				email
				join_date
				photo_thumb_small
				title
				teams {
					id
					name
					picture_url
				}
				url
				is_guest
			}
		}`;
	}

	private userDetailsQuery(ids: number[]) {
		return `{
			users(ids: [${ids.join(', ')}]) {
				join_date
				photo_thumb_small
				title
				url
				teams {
					id
					name
				}
				is_guest
			}
		}`;
	}
}