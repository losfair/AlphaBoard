import ctypes
import flask
import pymongo
import time
import json
import gevent.pywsgi

utils = ctypes.CDLL("./utils.so")

utils.get_random_string.restype = ctypes.c_char_p
utils.get_random_string.argtypes = [ ctypes.c_int ]

utils.print_char_p_address.argtypes = [ ctypes.c_char_p ]

utils.init();

targetDb = pymongo.MongoClient().AlphaBoard

app = flask.Flask(__name__)

@app.route("/ping")
def onPing():
    resp = flask.Response()
    resp.set_data("Pong")
    resp.headers["Access-Control-Allow-Origin"] = "*"
    return resp

@app.route("/fetch", methods=["POST"])
def onFetch():
    resp = flask.Response()
    resp.headers["Access-Control-Allow-Origin"] = "*"

    targetCommitToken = flask.request.get_data()

    if targetCommitToken == None or len(targetCommitToken) != 8:
        resp.set_data("Bad request")
        return resp
    
    retData = "";
    
    targetData = {
        "parent": targetCommitToken
    }
    
    retArr = []
    
    while targetData["parent"] != "root":
        targetData = targetDb.commits.find_one({"token": targetData["parent"]})
        if targetData == None:
            resp.set_data("Not found")
            return resp

        targetActions = json.loads(targetData["actions"])
        if targetActions == None or type(targetActions) != list:
            resp.set_data("Unable to parse actions")
            return resp

        targetActions.reverse();

        isReset = False
        
        for newAction in targetActions:
            if type(newAction) != dict:
                resp.set_data("Bad action data type")
                return resp
            
            if newAction.has_key("actionType") == False:
                resp.set_data("Bad action type")
                return resp
            
            if newAction["actionType"] == "reset":
                isReset = True
                break
            else:
                retArr.append(newAction)
        
        if isReset:
            break

    retArr.reverse();

    retData = json.dumps(retArr)
    
    resp.set_data(retData)
    return resp

@app.route("/commit", methods=["POST"])
def onCommit():
    resp = flask.Response()
    resp.headers["Access-Control-Allow-Origin"] = "*"
    
    req_data = json.loads(flask.request.get_data())
    if req_data == None:
        resp.set_data("Failed")
        return resp
    
    try:
        parentCommit = req_data["parentCommit"]
        actions = req_data["actions"]
    except KeyError:
        resp.set_data("Bad arguments")
        return resp

    if parentCommit == None or actions == None or type(parentCommit) != unicode or type(actions) != list:
        resp.set_data("Failed")
        return resp

    if parentCommit != "root":
        parentCommitItem = targetDb.commits.find_one({"token": parentCommit})

        if parentCommitItem == None:
            resp.set_data("Parent commit not found")
            return resp
    
    newToken = utils.get_random_string(8)
    utils.free_memory();

    targetDb.commits.insert({
        "token": newToken,
        "parent": parentCommit,
        "actions": json.dumps(actions),
        "time": str(int(time.time() * 1000))
    })

    resp.set_data(newToken)
    return resp

if __name__ == "__main__":
#    utils.enable_debug();
    gevent_server = gevent.pywsgi.WSGIServer(("",6095), app)
    gevent_server.serve_forever()
