'use strict';

module.exports = class Limiter
{
    static get RateLimiter()
    {
        return require('./rate_limiter');
    }

    static get StreamLimiter()
    {
        return require('./stream_limiter');
    }
}