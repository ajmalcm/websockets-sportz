import express from "express";
import matchesRouter from "./routes/matches.js";

const app=express();

app.use(express.json());


app.get("/",(req,res)=>{
    res.json({msg:"helloo init api"}).status(200)
})

app.use("/matches", matchesRouter);

const port=8080

app.listen(port,()=>{
    console.log("listening on port:",port);
})