const { RateLimiter } = require('../lib/limiter');
const SLEEP = ms => new Promise( r => setTimeout( r, ms ));

console.log( require('os').cpus().length );


let limiter = new RateLimiter({ limit: 2 }); //require('os').cpus().length });

let start = Date.now();

async function job( i )
{
    let ms = Math.floor( 500 + Math.random() * 900 );

    console.log('--');

    await SLEEP( ms );

    return 'bar [' + i + '] @ ' + ms + ' - ' + ( Date.now() - start );
}

async function test()
{
    for( let i = 0; i < 10; ++i )
    {
        limiter.execute( i % 3, job.bind( null, i % 3 )).timeout(5000).then( console.log ).catch( e => console.error( e, i % 3 ));
    }

    await SLEEP( 1000 );

    for( let i = 0; i < 10; ++i )
    {
        limiter.execute( i % 3, job.bind( null, i % 3 )).timeout(5000).then( console.log ).catch( e => console.error( e, i % 3 ));
    }
}

test();