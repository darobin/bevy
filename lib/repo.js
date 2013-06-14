
// a fair amount of this stuff is stolen from haibu
var fs = require("fs")
,   spawn = require("child_process").spawn
,   utils = require("util")
,   EventEmitter = require("events").EventEmitter
,   shortid = require("shortid")
;

// Handle update sessions for long-running processes
function UpdateSession () {
    this.id = shortid.generate();
    this.done = false;
    this.queue = [];
}
utils.inherits(UpdateSession, EventEmitter);
UpdateSession.prototype.progress = function (msg) {
    this.queue.push(["progress", msg]);
    this.emit("progress", msg);
    return this;
};
UpdateSession.prototype.error = function (msg) {
    this.queue.push(["error", msg]);
    this.emit("error", msg);
    return this;
};
UpdateSession.prototype.end = function () {
    this.done = true;
    this.queue.push(["end"]);
    this.emit("end");
    return this;
};
// returns the queue of messages, and empties it
UpdateSession.prototype.messages = function () {
    var ret = this.queue;
    this.queue = [];
    return ret;
};


function sessionAndCBErr (session, err, cb) {
    session.error(err).end();
    cb(err);
}

function npmInstall (app, conf, session, cb) {
    session.progress("Running npm install.\n");
    var spawnOpt = { cwd: app.contentPath };
    if (conf.uid) spawnOpt.uid = conf.uid;
    if (conf.gid) spawnOpt.gid = conf.gid;
    var child = spawn("npm", ["install", "-d"], spawnOpt);
    child.on("error", function (err) {
        sessionAndCBErr(session, err, cb);
    });
    child.on("exit", function (code) {
        if (code === null) return; // normally "error" has been triggered
        if (code === 0) {
            session.progress("Dependencies installed.\n").end();
            cb();
        }
        else {
            sessionAndCBErr(session, "Exit code for npm install: " + code, cb);
        }
    });
    child.stdout.on("data", function (data) {
        session.progress(data instanceof Buffer ? data.toString("utf8") : data);
    });
    child.stderr.on("data", function (data) {
        session.progress(data instanceof Buffer ? data.toString("utf8") : data);
    });
}

function git (app, conf, session, cb) {
    fs.exists(app.contentPath, function (exists) {
        var commands = []
        ,   branch = app.repository.branch || "master"
        ;
        if (exists) {
            commands.push(["git", "fetch origin".split(" "), app.contentPath]);
            commands.push(["git", ("reset --hard refs/remotes/origin/" + branch).split(" "), app.contentPath]);
        }
        else {
            // note that you don't want to let just about anyone give you URLs
            // they're run on the CLI, you could have a bad time
            commands.push(["git", ["clone", app.repository.url, "content"], app.storePath]);
        }
        commands.push(["git", "submodule update --init --recursive".split(" "), app.contentPath]);
        
        var totCmd = commands.length;
        function runUntilEmpty () {
            var command = commands.shift()
            ,   curCmd = totCmd - commands.length;
            session.progress("Running git command " + curCmd + "/" + totCmd + ".\n");
            var spawnOpt = { cwd: command[2] };
            if (conf.uid) spawnOpt.uid = conf.uid;
            if (conf.gid) spawnOpt.gid = conf.gid;
            var child = spawn(command[0], command[1], spawnOpt);
            child.on("error", function (err) {
                sessionAndCBErr(session, err, cb);
            });
            child.on("exit", function (code) {
                if (code === null) return; // normally "error" has been triggered
                if (code === 0) {
                    session.progress("Done: git command " + curCmd + "/" + totCmd + ".\n");
                    commands.length > 0 ? runUntilEmpty() : npmInstall(app, conf, session, cb);
                }
                else {
                    sessionAndCBErr(session, "Exit code for git: " + code, cb);
                }
            });
            child.stdout.on("data", function (data) {
                session.progress(data instanceof Buffer ? data.toString("utf8") : data);
            });
            child.stderr.on("data", function (data) {
                if (data instanceof Buffer) data = data.toString("utf8");
                session.progress("[ERR]" + data);
            });
        }
        runUntilEmpty();
    });
}

exports.update = function (app, conf, cb) {
    if (app.repository.type === "git") {
        var session = new UpdateSession();
        git(app, conf, session, cb);
        return session;
    }
    cb("Unknown repository type " + app.repository.type);
};
