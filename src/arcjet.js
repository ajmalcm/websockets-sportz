import arcjet, { detectBot, shield, slidingWindow } from "@arcjet/node";

const arcjetKey=process.env.ARKJET_JEY;
const arcjetMode=process.env.ARKJET_MODE==='DRY_RUN'?'DRY_RUN':'LIVE'

if(!arcjetKey) throw new Error("Arcjet environment variable is missing.");


//for http requests
export const httpArcjet=arcjetKey?
arcjet({
    key:arcjetKey,
    rules:[
        shield({mode:arcjetMode}),
        detectBot({mode:arcjetMode,allow:['CATEGORY:SEARCH_ENGINE','CATEGORY:PREVIEW']}),  //prevents unwanted bots allows search engine and preview
        slidingWindow({mode:arcjetMode,interval:'10s',max:50}) //an ip can send 50requests per 10seconds
    ],
}):null;


//for websocket requests
export const wsArcjet=arcjetKey?
arcjet({
    key:arcjetKey,
    rules:[
        shield({mode:arcjetMode}),
        detectBot({mode:arcjetMode,allow:['CATEGORY:SEARCH_ENGINE','CATEGORY:PREVIEW']}),  //prevents unwanted bots allows search engine and preview
        slidingWindow({mode:arcjetMode,interval:'2s',max:5}) //an ip can send 50requests per 10seconds
    ],
}):null;

export function securityMiddleware()
{
    return async(req,res,next)=>{
        if(!httpArcjet) return next();

        try{
            const decision=await httpArcjet.protect(req);
            if(decision.isDenied())
            {
                if(decision.reason.isRateLimit())
                    return res.status(429).json({error:"Too many requests!."})
            }

            return res.status(403).json({error:"Forbidden."})

        }
        catch(error)
        {
            console.error('Arcjet middleware error',error);
            return res.status(503).json({error:"Service Unavailable."})
        }

        next();

    }
}