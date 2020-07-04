import * as React from 'react';

export const Icon = ({ className='', src, title }: { className?: string, title?: string, src: string }) =>
	<span className={`icon ${className}`} title={title} dangerouslySetInnerHTML={{ __html: src }} />;

export default Icon;

export const commitIcon = <Icon src={require('../resources/icons/commit_icon.svg')} />;
export const mergeIcon = <Icon src={require('../resources/icons/merge_icon.svg')} />;
export const editIcon = <Icon src={require('../resources/icons/edit.svg')} />;
export const checkIcon = <Icon src={require('../resources/icons/check.svg')} />;
export const plusIcon = <Icon src={require('../resources/icons/plus.svg')} />;
export const deleteIcon = <Icon src={require('../resources/icons/delete.svg')} />;
export const pendingIcon = <Icon src={require('../resources/icons/dot.svg')} />;
export const commentIcon = <Icon src={require('../resources/icons/comment.svg')} />;
export const diffIcon = <Icon src={require('../resources/icons/diff.svg')} />;
export const alertIcon = <Icon src={require('../resources/icons/alert.svg')} />;
