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
    
    targetData = targetDb.commits.find_one({"token": targetCommitToken})
    if targetData == None:
        resp.set_data("Not found")
        return resp
    
    resp.set_data(targetData["actions"])
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
        print(type(parentCommit))
        return resp
    
    if parentCommit != "root":
        resp.set_data("Not implemented")
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
