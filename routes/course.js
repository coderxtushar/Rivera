const {Router} = require("express");

const courseRouter = Router();

courseRouter.post("/purchase", function(req,res){
    res.json({
        message : "Signup Endpoint"
    })
})

courseRouter.get("/preview", function(req,res){
    res.json({
        message : "Signup Endpoint"
    })
})

module.exports = {
    courseRouter: courseRouter
}