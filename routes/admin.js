const {Router} = require("express");
const adminRouter = Router();

const adminModel = require("../db");

//adminRouter.use(adminMiddlware);

adminRouter.post("/signup", function(req, res){
    res.json({
        message: "signup endpoint"
    })
})

adminRouter.post("/signin", function(req, res){
    res.json({
        message: "signup endpoint"
    })
})

adminRouter.post("/course/upload", function(req, res){
    res.json({
        message: "course created"
    })
})

adminRouter.put("/course", function(req, res){
    res.json({
        message: "course created"
    })
})
adminRouter.get("/course/bulk", function(req, res){
    res.json({
        message: "course created"
    })
})

module.exports ={
    adminRouter: adminRouter
}