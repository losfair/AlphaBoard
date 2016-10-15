var dbClient = require("mongodb").MongoClient;
var express = require("express");
var randomstring = require("randomstring");

var app = express();

var dbContext;

app.use(function(req, res, next) {
    req.rawBody = '';
    req.setEncoding('utf8');

    req.on('data', function(chunk) { 
        req.rawBody += chunk;
    });

    req.on('end', function() {
        next();
    });
});

app.post("/fetch",function(req,resp) {
    resp.set("Access-Control-Allow-Origin","*");
    
    var targetCommitToken = req.rawBody;

    new Promise(function(callback) {
        dbContext.collection("commits").find({"token": targetCommitToken}).toArray(function(err,result) {
            if(err || !result.length) callback(null);
            else callback(result[0]);
        });
    }).then(function(target) {
        if(!target) {
            resp.send("Failed");
            return;
        }
        resp.send(target.actions);
    });
});

app.post("/commit",function(req,resp) {
    resp.set("Access-Control-Allow-Origin","*");

    try {
        var reqData = JSON.parse(req.rawBody);
        var parentCommit = reqData.parentCommit;
        var actions = reqData.actions;

        if(!parentCommit || !actions || typeof(parentCommit) != "string" || (typeof(actions) != "array" && typeof(actions) != "object")) throw "Bad arguments";
    } catch(e) {
        resp.send(e.toString());
    }

    var newToken = "";

    new Promise(function(callback) {
        if(parentCommit == "root") callback("OK");
        dbContext.collection("commits").find({"token": parentCommit}).toArray(function(err,result) {
            if(err || !result.length) callback("Failed");
            else callback("OK");
        });
    }).then(function(result) {
        if(result != "OK") {
            resp.send("Failed #1");
            return;
        }
        newToken = randomstring.generate(8);
        return new Promise(function(callback) {
            dbContext.collection("commits").insert({
                "token": newToken,
                "parent": parentCommit,
                "actions": JSON.stringify(actions)
            }, function(err, result) {
                if(err) {
                    callback("Failed");
                } else {
                    callback("OK");
                }
            });
        });
    }).then(function(result) {
        if(result != "OK") {
            resp.send("Failed #2");
            return;
        }
        resp.send(newToken);
    });
});

dbClient.connect("mongodb://127.0.0.1:27017/AlphaBoard",function(err,db) {
    if(err) throw err;
    dbContext = db;
    var server = app.listen(6095,function() {
        console.log("Server listening on "+server.address().address+":"+server.address().port);
    });
});