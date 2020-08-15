/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export enum EventType {
    Committed,
    Mentioned,
    Subscribed,
    Commented,
    Reviewed,
    Labeled,
    Milestoned,
    Assigned,
    HeadRefDeleted,
    Merged,
    Other,
}

export interface Committer {
    date: string;
    name: string;
    email: string;
}

export interface CommentEvent {
    id: number;
    htmlUrl: string;
    body: string;
    bodyHTML?: string;
    user: any;
    event: EventType;
    canEdit?: boolean;
    canDelete?: boolean;
    createdAt: string;
}

export interface ReviewEvent {
    id: number;
    event: EventType;
    comments: any[];
    submittedAt: string;
    body: string;
    bodyHTML?: string;
    htmlUrl: string;
    user: any;
    authorAssociation: string;
    state: 'COMMENTED' | 'APPROVED' | 'CHANGES_REQUESTED' | 'PENDING' | 'REQUESTED';
}

export interface CommitEvent {
    id: number;
    author: any;
    event: EventType;
    sha: string;
    htmlUrl: string;
    message: string;
    bodyHTML?: string;
}

export interface MergedEvent {
    id: number;
    graphNodeId: string;
    user: any;
    createdAt: string;
    mergeRef: string;
    sha: string;
    commitUrl: string;
    event: EventType;
    url: string;
}

export interface AssignEvent {
    id: number;
    event: EventType;
    user: any;
    actor: any;
}

export interface HeadRefDeleteEvent {
    id: string;
    event: EventType;
    actor: any;
    createdAt: string;
    headRef: string;
}

export type TimelineEvent = CommitEvent | ReviewEvent | CommentEvent | MergedEvent | AssignEvent | HeadRefDeleteEvent;

export function isReviewEvent(event: TimelineEvent): event is ReviewEvent {
    return event.event === EventType.Reviewed;
}

export function isCommitEvent(event: TimelineEvent): event is CommitEvent {
    return event.event === EventType.Committed;
}

export function isCommentEvent(event: TimelineEvent): event is CommentEvent {
    return event.event === EventType.Commented;
}

export function isMergedEvent(event: TimelineEvent): event is MergedEvent {
    return event.event === EventType.Merged;
}

export function isAssignEvent(event: TimelineEvent): event is AssignEvent {
    return event.event === EventType.Assigned;
}

export function isHeadDeleteEvent(event: TimelineEvent): event is HeadRefDeleteEvent {
    return event.event === EventType.HeadRefDeleted;
}
