import {
	PullRequestResponse as PullRequestGraphQL,
	TimelineEventsResponse as TimelineEventsGraphQL
} from '../../github/graphql';
import { Octokit } from '@octokit/rest';

import { PullRequestBuilder as PullRequestGraphQLBuilder } from './graphql/pullRequestBuilder';
import { PullRequestBuilder as PullRequestRESTBuilder, PullRequestUnion as PullRequestREST } from './rest/pullRequestBuilder';
import { TimelineEventsBuilder as TimelineEventsGraphQLBuilder } from './graphql/timelineEventsBuilder';
import { RepoUnion as RepositoryREST, RepositoryBuilder as RepositoryRESTBuilder } from './rest/repoBuilder';
import { CombinedStatusBuilder as CombinedStatusRESTBuilder } from './rest/combinedStatusBuilder';
import { ReviewRequestsBuilder as ReviewRequestsRESTBuilder } from './rest/reviewRequestsBuilder';
import { createBuilderClass } from './base';

type ResponseFlavor<APIFlavor, GQL, RST> = APIFlavor extends 'graphql' ? GQL : RST;

export interface ManagedPullRequest<APIFlavor> {
	pullRequest: ResponseFlavor<APIFlavor, PullRequestGraphQL, PullRequestREST>;
	timelineEvents: ResponseFlavor<APIFlavor, TimelineEventsGraphQL, Octokit.IssuesListEventsForTimelineResponseItem[]>;
	repositoryREST: RepositoryREST;
	combinedStatusREST: Octokit.ReposGetCombinedStatusForRefResponse;
	reviewRequestsREST: Octokit.PullsListReviewRequestsResponse;
}

export const ManagedGraphQLPullRequestBuilder = createBuilderClass<ManagedPullRequest<'graphql'>>()({
	pullRequest: {linked: PullRequestGraphQLBuilder},
	timelineEvents: {linked: TimelineEventsGraphQLBuilder},
	repositoryREST: {linked: RepositoryRESTBuilder},
	combinedStatusREST: {linked: CombinedStatusRESTBuilder},
	reviewRequestsREST: {linked: ReviewRequestsRESTBuilder},
});

export type ManagedGraphQLPullRequestBuilder = InstanceType<typeof ManagedGraphQLPullRequestBuilder>;

export const ManagedRESTPullRequestBuilder = createBuilderClass<ManagedPullRequest<'rest'>>()({
	pullRequest: {linked: PullRequestRESTBuilder},
	timelineEvents: {default: []},
	repositoryREST: {linked: RepositoryRESTBuilder},
	combinedStatusREST: {linked: CombinedStatusRESTBuilder},
	reviewRequestsREST: {linked: ReviewRequestsRESTBuilder},
});

export type ManagedRESTPullRequestBuilder = InstanceType<typeof ManagedRESTPullRequestBuilder>;