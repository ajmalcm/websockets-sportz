import express from "express";
import http from "http";
import matchesRouter from "./routes/matches.js";
import { attachWebSocketServer } from "./ws/server.js";
import { securityMiddleware } from "./arcjet.js";

const app=express();
const server=http.createServer(app);
const PORT=Number(process.env.PORT || 8080);
const HOST=process.env.HOST||'0.0.0.0';

app.use(express.json());


app.get("/",(req,res)=>{
    res.json({msg:"helloo init api"}).status(200)
})


app.use(securityMiddleware());
app.use("/matches", matchesRouter);

const {broadcastMatchCreated}=attachWebSocketServer(server);
app.locals.broadcastMatchCreated=broadcastMatchCreated;


server.listen(PORT,HOST,()=>{
    const baseUrl=HOST==='0.0.0.0'?`http://localhost:${PORT}`:`https://${HOST}:${PORT}`
    console.log(`server running on ${baseUrl}`);
    console.log(`Websocket server running on ${baseUrl.replace('http',"ws")}/ws`);
})