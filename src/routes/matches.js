import express from "express";
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/match-status.js";
import { desc } from "drizzle-orm";


const router=express.Router();

router.get("/",async (req,res)=>{
    const parsed = listMatchesQuerySchema.safeParse(req.query);
    const MAX_LIMIT=100;
    
    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid Query Parameters", details: JSON.stringify(parsed.error) });
    }

    const limit= Math.min(parsed.data.limit ?? 50,MAX_LIMIT);

    try{
        const data=await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit);
        return res.status(200).json({data});
    }
    catch(err)
    {
        return res.status(500).json({error:"Failed to fetch matches",details:err.stack});
    }
})

router.post("/",async (req,res)=>{
    const parsed = createMatchSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({ error: "Invalid Payload", details: JSON.stringify(parsed.error) });
    }

    // destructure after validation to avoid accessing parsed.data when invalid
    const { startTime, endTime, homeScore, awayScore, ...rest } = parsed.data;

    try{
        const [event] = await db.insert(matches).values({
            ...rest,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
            status: getMatchStatus(startTime, endTime),
        }).returning();

        return res.status(201).json({msg:"Match created successfully",data:event});
    }
    catch(err)
    {
        return res.status(500).json({error:"Failed to create match",details:err.stack});
    }
})

export default router;