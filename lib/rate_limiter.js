'use strict';

const EventEmitter = require('events');
const Options = require('@liqd-js/options');
const TimedPromise = require('@liqd-js/timed-promise');

class Task
{
    #callback; #promises = []; #on_complete = [];

    constructor( callback )
    {
        this.#callback = callback;
        this.priority = 1;
    }

    add_promise( promise, priority = 1 )
    {
        this.#promises.push( promise );
        this.priority = Math.max( this.priority, priority );

        return this;
    }

    get settled()
    {
        return !this.#promises.find( p => !p.instance.settled );
    }

    async execute()
    {
        let err, result;

        try
        {
            result = await this.#callback();
        }
        catch( e ){ err = e }

        for( let handler of this.#on_complete )
        {
            handler();
        }

        for( let promise of this.#promises )
        {
            if( !promise.instance.settled )
            {
                err ? promise.reject( err ) : promise.resolve( result );
            }
        }
    }

    on_complete( handler )
    {
        this.#on_complete.push( handler );

        return this;
    }
}

module.exports = class RateLimiter extends EventEmitter
{
    #options; #running_tasks = 0; #pending_tasks = []; #index = new Map(); #tasks_sorted = true;

    constructor( options )
    {
        super();

        this.#options = Object.assign(
        {
            limit: 12,
            score: ( a, b ) => 0
        },
        options || {});
    }

    async _schedule( task )
    {
        if( !task )
        {
            if( this.#pending_tasks.length )
            {
                if( !this.#tasks_sorted )
                {
                    this.#pending_tasks.sort( this.#options.score );
                    this.#tasks_sorted = true;
                }

                while( this.#pending_tasks.length )
                {
                    task = this.#pending_tasks.shift();

                    if( !task.settled )
                    {
                        return process.nextTick( async() => 
                        {
                            await task.execute();

                            this._schedule();
                        });
                    }
                }
            }
            
            if( this.#running_tasks-- === this.#options.limit ){ this.emit( 'pending' )}
            if( !this.#running_tasks ){ this.emit( 'empty' )}
        }
        else if( this.#pending_tasks.length || this.#running_tasks === this.#options.limit )
        {
            this.#pending_tasks.push( task );
            this.#tasks_sorted = false;
        }
        else
        {
            if( ++this.#running_tasks === this.#options.limit ){ this.emit( 'full' )}

            await task.execute();

            this._schedule();
        }
    }

    execute( options, callback )
    {
        if( typeof options === 'function' ){[ options, callback ] = [ undefined, options ]}
        if( typeof options !== 'object' ){ options = { id: options }} 
        if( typeof options === 'undefined' ){ options = {}}

        let promise = new TimedPromise(( resolve, reject ) =>
        {
            let task = ( options.id !== undefined && this.#index.get( options.id ));

            if( !task )
            {
                this._schedule( task = new Task( callback ).add_promise({ instance: promise, resolve, reject }, options.priority ));

                if( options.id !== undefined )
                {
                    this.#index.set( options.id, task.on_complete(() => this.#index.delete( options.id )));
                }
            }
            else
            {
                task.add_promise({ instance: promise, resolve, reject }, options.priority );

                this.#tasks_sorted = this.#pending_tasks.length ? false : true;
            }
        });

        return promise;
    }
}