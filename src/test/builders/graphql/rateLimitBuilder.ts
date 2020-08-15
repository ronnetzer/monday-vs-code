import { createBuilderClass } from '../base';

export const RateLimitBuilder = createBuilderClass<unknown>()({
    limit: { default: 5000 },
    cost: { default: 0 },
    remaining: { default: 4999 },
    resetAt: { default: '3019-01-01T00:00:00Z' },
});

export type RateLimitBuilder = InstanceType<typeof RateLimitBuilder>;
