const express = require("express");
const app = express();

const mongoose = require("mongoose");

app.get("/course_list", async(req,res)=>{
    res.json({
        message: "See all your courses here"
    })
})

app.post("/user/signup", async(req,res)=>{
    res.json({
        messsage : "User Signed up"
    })
})

app.get("/purchased/courses", async(req,res)=>{
    res.json({
        message : "See all your purchased courses here"
    })
})

app.post("/signin", function(req,res){
    res.json({ message: "User Signed In" 
    })
})

app.put("/signin", function(req,res){
    res.json({
        message: "User Signed In" 
    })
})




app.listen(3000);