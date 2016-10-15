var drawingCxt;
var cvsHeight,cvsWidth;

var isDrawing = false;

var lineMode = "any"; // "any", "straight"

var currentPath = [];

var paths = [];

var actions = [];

var drawingDisabled = false;

var isSticky = true;

var stickyRadius = 5;

var coverLayer;
var coverCxt;

const serverAddr = "http://192.168.2.107:6095";

function toggleFullScreen() {
  if ((document.fullScreenElement && document.fullScreenElement !== null) ||    
   (!document.mozFullScreen && !document.webkitIsFullScreen)) {
    if (document.documentElement.requestFullScreen) {  
      document.documentElement.requestFullScreen();  
    } else if (document.documentElement.mozRequestFullScreen) {  
      document.documentElement.mozRequestFullScreen();  
    } else if (document.documentElement.webkitRequestFullScreen) {  
      document.documentElement.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);  
    }  
  } else {  
    if (document.cancelFullScreen) {  
      document.cancelFullScreen();  
    } else if (document.mozCancelFullScreen) {  
      document.mozCancelFullScreen();  
    } else if (document.webkitCancelFullScreen) {  
      document.webkitCancelFullScreen();  
    }  
  }  
}

function getQueryString(name)
{
    var reg = new RegExp("(^|&)"+ name +"=([^&]*)(&|$)");
    var r = window.location.search.substr(1).match(reg);
    if(r) return unescape(r[2]);
    else return null;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length,c.length);
        }
    }
    return "";
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function randomNumeric() {
    var str = "";

    str += Math.floor(Math.random()*100000).toString();
    str += "_";
    str += Math.floor(Math.random()*100000).toString();
    str += "_";
    str += Math.floor(Math.random()*100000).toString();
    str += "_";
    str += Math.floor(Math.random()*100000).toString();

    return str;
}

function clearCanvas() {
    cvsHeight = document.getElementById("drawing").height;
    cvsWidth = document.getElementById("drawing").width;

    document.getElementById("drawing").width = 0;
    document.getElementById("drawing").height = 0;

    document.getElementById("drawing").width = cvsWidth;
    document.getElementById("drawing").height = cvsHeight;

    drawingCxt.clearRect(0,0,cvsWidth,cvsHeight);

    drawingCxt.fillStyle = "#333333";
    drawingCxt.fillRect(0,0,cvsWidth,cvsHeight);

    drawingCxt.fillStyle = "#FFFFFF";
    drawingCxt.strokeStyle = "#FFFFFF";
}

function resetEverything(noLog) {
    if(!noLog) {
        actions.push({
            "id": randomNumeric(),
            "actionType": "reset",
            "objectType": ""
        });
    }

    paths = [];
    currentPath = [];
    clearCanvas();
}

function renderAllPaths() {
    clearCanvas();
    for(var i in paths) {
        var currPath = paths[i];
        if(!currPath) continue;
        if(currPath.type) {
            var currType = currPath.type;
            if(currType == "circle") {
                var props = currPath.props;
                if(props.length != 3) continue;
                drawingCxt.moveTo(props[0] + props[2], props[1]);
                drawingCxt.arc(props[0], props[1], props[2], 0, Math.PI * 2);
            }
            continue;
        }
        if(currPath.length < 1) continue;
        drawingCxt.moveTo(currPath[0][0],currPath[0][1]);
        for(var j = 1; j < currPath.length; j++) {
            drawingCxt.lineTo(currPath[j][0],currPath[j][1]);
        }
    }
    drawingCxt.stroke();
    console.log(paths);
}

function getActions() {
    return JSON.stringify(actions);
}

function loadActions(ats) {
    actions = ats;
    paths = [];
    for(var i in actions) {
        var currAction = actions[i];
        console.log("Loading action "+currAction.id);
        switch(currAction.actionType) {
            case "new":
                switch(currAction.objectType) {
                    case "path":
                        paths.push(currAction.points);
                        break;
                    default:
                        throw "Unknown object type "+currAction.objectType;
                }
                break;
            case "reset":
                resetEverything(true);
                break;
            default:
                throw "Unknown action type "+currAction.actionType;
        }
    }
    renderAllPaths();
}

function loadActionsFromServer(commitToken) {
    $.post(serverAddr+"/fetch",commitToken,function(resp) {
        if(resp == "Failed") return;
        loadActions(JSON.parse(resp));
        $("#last-commit-id").html(commitToken);
    });
}

function cancelStep() {
    if(actions.length == 0) return;
    actions.pop();
    clearCanvas();
    loadActions(actions);
}

function commitActions(callback) {
    $.post(serverAddr+"/commit",JSON.stringify({
        "parentCommit": "root",
        "actions": actions
    }),function(resp) {
        if(resp=="Failed" || resp.length != 8) {
            alert("提交失败。");
            return;
        }
        $("#last-commit-id").html(resp);
        setCookie("AlphaBoard-Last-Commit-Id",resp,30);
        if(callback) callback(resp);
    })
}

function showCoverDiv(msg) {
    $("#cover-div").html(msg);
    $("#cover-div").css("line-height",$("#cover-div").css("height"));
    $("#cover-div").fadeIn();
    $("#cover-div").dblclick(function() {
        $("#cover-div").fadeOut();
        $("#cover-div").click(function() {});
    });
}

function commitAndShare() {
    commitActions(function(token) {
        showCoverDiv(window.location.href + "?load=" + token);
    });
}

var actionListShowed = false;

function toggleActionList() {
    if(!actionListShowed) {
        actionListShowed = true;
        drawingDisabled = true;
        updateActionList();
        $("#action-list").fadeIn();
        $("#cover-div").html("");
        $("#cover-div").fadeIn();
        $("#cover-div").click(toggleActionList);
    } else {
        actionListShowed = false;
        drawingDisabled = false;
        $("#cover-div").unbind("click");
        $("#action-list").fadeOut();
        $("#cover-div").fadeOut();
    }
}

function cancelActionsInList() {
    var children = $("#action-list-content").children("tr");
    for(var i=0; i<children.length; i++) {
        if(children[i].isSelected) {
            for(var j=0; j<actions.length; j++) {
                if(actions[j].id == children[i].actionId) {
                    actions.splice(j,1);
                    break;
                }
            }
        }
    }
    updateActionList();
    loadActions(actions);
}

function updateActionList() {
    var actionList = document.getElementById("action-list-content");

    actionList.innerHTML = "";

    for(var id = actions.length - 1; id >= 0 && id >= actions.length - 10; id--) {
        var item = actions[id];
        var actionDesc = "";

        switch(item.actionType) {
            case "new":
                actionDesc = "新建";
                switch(item.objectType) {
                    case "path":
                        if(item.hasOwnProperty("desc")) actionDesc += item.desc;
                        else actionDesc += "路径";

                        if(!item.points.type) {
                            actionDesc += " 从 "+Math.floor(item.points[0][0])+","+Math.floor(item.points[0][1])
                                +" 到 "+Math.floor(item.points[item.points.length - 1][0])+","+Math.floor(item.points[item.points.length - 1][1]);
                        }
                        break;
                    default:
                        actionDesc += item.objectType;
                }
                break;
            case "reset":
                actionDesc = "重置";
                break;
            default:
                actionDesc = item.actionType;
        }

        var newElement = document.createElement("tr");
        newElement.innerHTML = actionDesc;
        newElement.actionId = item.id;

        $(newElement).click(function(e) {
            if(e.target.isSelected) {
                $(e.target).css("background","none");
                $(e.target).css("color","#FFFFFF");
                e.target.isSelected = false;
            } else {
                $(e.target).css("background-color","#FFFFFF");
                $(e.target).css("color","#000000");
                e.target.isSelected = true;
            }
        });

        actionList.appendChild(newElement);
    }
}

function onResize() {
    setTimeout(function() {
        cvsWidth = $(document).width();
        cvsHeight = $(document).height() - 50;

        document.getElementById("drawing").width = cvsWidth;
        document.getElementById("drawing").height = cvsHeight;

        renderAllPaths();
    },100);
}

function startCheckResize() {
    var prevHeight,prevWidth;

    prevWidth = $(document).width();
    prevHeight = $(document).height();

    setInterval(function() {
        if($(document).width() != prevWidth || $(document).height() != prevHeight) {
            onResize(); 
            prevWidth = $(document).width();
            prevHeight = $(document).height();
        }
    },500);
}

function switchFullScreen() {
    toggleFullScreen();
    onResize();
}

window.addEventListener("load",function() {
    cvsWidth = $(document).width();
    cvsHeight = $(document).height() - 50;

    document.getElementById("drawing").width = cvsWidth;
    document.getElementById("drawing").height = cvsHeight;

    drawingCxt = document.getElementById("drawing").getContext("2d");

    drawingCxt.strokeStyle = "#FFFFFF";

    clearCanvas();

    var initialCommit = getQueryString("load");
    if(!initialCommit) var initialCommit = getCookie("AlphaBoard-Last-Commit-Id");

    if(initialCommit) {
        loadActionsFromServer(initialCommit);
    }

    startCheckResize();
});

function drawBegin(e) {
    if(drawingDisabled) return;

    var targetX = e.pageX, targetY = e.pageY;

    if(targetX > cvsWidth || targetY > cvsHeight) return;

    isDrawing = true;

    var foundStickingTarget = false;

    if(isSticky) {
        for(var i in paths) {
            var currPath = paths[i];
            for(var j in currPath) {
                var pt = currPath[j];
                if(Math.abs(pt[0] - e.pageX) <= stickyRadius && Math.abs(pt[1] - e.pageY) <= stickyRadius) {
                    targetX = pt[0];
                    targetY = pt[1];
                    foundStickingTarget = true;
                    break;
                }
            }
            if(foundStickingTarget) break;
        }
    }

    currentPath.push([targetX, targetY]);

    coverLayer = document.createElement("canvas");
    coverLayer.width = $(document).width();
    coverLayer.height = $(document).height() - 50;

    $(coverLayer).css("position","fixed");
    $(coverLayer).css("top","0px");
    $(coverLayer).css("bottom","0px");
    $(coverLayer).css("left","0px");
    $(coverLayer).css("right","0px");

    coverCxt = coverLayer.getContext("2d");
    coverCxt.fillStyle = "#FFFFFF";
    coverCxt.strokeStyle = "#FFFFFF";

    coverCxt.moveTo(targetX, targetY);

    document.body.appendChild(coverLayer);
}

$(document).mousedown(drawBegin);
document.addEventListener("touchstart",function(e) {
    drawBegin(e.touches[0]);
});

function drawEnd() {
    if(drawingDisabled || !isDrawing) return;

    isDrawing = false;

    var origX = currentPath[currentPath.length - 1][0], origY = currentPath[currentPath.length - 1][1];

    var targetX = origX, targetY = origY;

    var foundStickingTarget = false;

    if(isSticky) {
        for(var i in paths) {
            var currPath = paths[i];
            for(var j in currPath) {
                var pt = currPath[j];
                if(Math.abs(pt[0] - origX) <= stickyRadius && Math.abs(pt[1] - origY) <= stickyRadius) {
                    targetX = pt[0];
                    targetY = pt[1];
                    foundStickingTarget = true;
                    break;
                }
            }
            if(foundStickingTarget) break;
        }
    }

    coverCxt.lineTo(targetX, targetY);
    coverCxt.stroke();

    currentPath.push([targetX, targetY]);

    if(lineMode == "straight") {
        paths.push([currentPath[0],currentPath[currentPath.length - 1]]);
        actions.push({
            "id": randomNumeric(),
            "actionType": "new",
            "objectType": "path",
            "desc": "直线",
            "points": [currentPath[0],currentPath[currentPath.length - 1]]
        });
    } else if(lineMode == "rect") {
        var startPt = currentPath[0];
        var endPt = currentPath[currentPath.length - 1];
        var ptA = [endPt[0], startPt[1]];
        var ptB = [startPt[0], endPt[1]];
        var targetPath = [startPt,ptA,endPt,ptB,startPt];
        paths.push(targetPath);
        actions.push({
            "id": randomNumeric(),
            "actionType": "new",
            "objectType": "path",
            "desc": "矩形",
            "points": targetPath
        });
    } else if(lineMode == "circle") {
        var centerPt = currentPath[0];
        var endPt = currentPath[currentPath.length - 1];

        var distanceX = Math.abs(endPt[0] - centerPt[0]);
        var distanceY = Math.abs(endPt[1] - centerPt[1]);
        var distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        var targetPath = {
            "type": "circle",
            "props": [centerPt[0], centerPt[1], distance]
        };

        paths.push(targetPath);

        actions.push({
            "id": randomNumeric(),
            "actionType": "new",
            "objectType": "path",
            "desc": "圆",
            "points": targetPath
        })
    } else {
        paths.push(currentPath);
        actions.push({
            "id": randomNumeric(),
            "actionType": "new",
            "objectType": "path",
            "points": currentPath
        });
    }

    currentPath = [];

    document.body.removeChild(coverLayer);
    coverLayer = null;
    coverCxt = null;

    renderAllPaths();
}

$(document).mouseup(drawEnd);
document.addEventListener("touchend",function() {
    drawEnd();
});

function drawMove(e) {
    if(drawingDisabled) return;

    if(!isDrawing) return;

    //e.preventDefault();

    coverCxt.lineTo(e.pageX, e.pageY);
    coverCxt.stroke();

    currentPath.push([e.pageX, e.pageY]);
}


$(document).mousemove(drawMove);
document.addEventListener("touchmove",function(e) {
    drawMove(e.touches[0]);
});