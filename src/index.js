import express from "express";

const app=express();

app.use(express.json());


app.get("/",(req,res)=>{
    res.json({msg:"helloo init api"}).status(200)
})

const port=8080

app.listen(port,()=>{
    console.log("listening on port:",port);
})