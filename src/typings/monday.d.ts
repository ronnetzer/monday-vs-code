// TODO: one day -.-
declare module 'monday-sdk-js' {
	export = init;

	namespace init {
    export interface MondaySDKResponse<T> {
      data: T;
      account_id: string;
    }

		export interface MondaySDK {
			setToken: (token: string) => void;
			api: <T = any>(query: string, options: any) => Promise<MondaySDKResponse<T>>;
			oauthToken: (code: string, clientId: string, clientSecret: string) => Promise<any>;
		}
	}

	function init(options?: { token: string }): MondaySDK;
}

/**
  constructor(options = {}) {
    this._token = options.token;

    this.setToken = this.setToken.bind(this);
    this.api = this.api.bind(this);
  }

  setToken(token) {
    this._token = token;
  }

  async api(query, options = {}) {
    const params = { query, variables: options.variables };
    const token = options.token || this._token;

    if (!token) throw new Error(TOKEN_MISSING_ERROR);

    return await mondayApiClient.execute(params, token);
  }

  oauthToken(code, clientId, clientSecret) {
    return oauthToken(code, clientId, clientSecret);
  }
 */