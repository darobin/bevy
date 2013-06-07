
// a fair amount of this stuff is stolen from haibu
var fs = require("fs")
,   exec = require("child_process").exec
,   utils = require("util")
,   EventEmitter = require("events").EventEmitter
,   npm = require("npm")
,   npmlog = npm.log
,   shortid = require("shortid")
,   npmConfig = {
        _exit:          false
    ,   exit:           false
    ,   "unsafe-perm":  true
    ,   loglevel:       "silent"
    ,   production:     true
    }
;

// Handle update sessions for long-running processes
function UpdateSession () {
    this.id = shortid.generate();
    this.done = false;
    this.logListener = (function (obj) {
        return function (msg) {
            obj.progress(msg);
        };
    })(this);
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
UpdateSession.prototype.registerLogListener = function () {
    npmlog.on("log", this.logListener);
};
UpdateSession.prototype.end = function () {
    npmlog.removeListener("log", this.logListener);
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

function npmInstall (app, session, cb) {
    session.progress("Loading npm.");
    session.registerLogListener();
    npm.load(npmConfig, function (err) {
        if (err) return sessionAndCBErr(session, err, cb);
        var what = [];
        Object.keys(app.dependencies).forEach(function (k) {
            what.push(k + "@" + app.dependencies[k]);
        });
        session.progress("Installing dependencies: " + what.join(", ") + ".");
        npm.commands.install(app.storePath, what, function (err) {
            if (err) return sessionAndCBErr(session, err, cb);
            session.progress("Dependencies installed.").end();
            cb();
        });
    });
}

function git (app, session, cb) {
    fs.exists(app.contentPath, function (exists) {
        var commands, branch = app.repository.branch || "master";
        if (exists) {
            commands = [
                "cd " + app.contentPath + " && git fetch origin && git reset --hard refs/remotes/origin/" + branch
            ];
        }
        else {
            // note that you don't want to let just about anyone give you URLs
            // they're run on the CLI, you could have a bad time
            commands = [
                "cd " + app.storePath + " && git clone " + app.repository.url + " content"
            ];
        }
        commands.push("cd " + app.contentPath + " && git submodule update --init --recursive");
        
        var totCmd = commands.length;
        function runUntilEmpty () {
            var command = commands.shift()
            ,   curCmd = totCmd - commands.length;
            session.progress("Running git command " + curCmd + "/" + totCmd + ".");
            exec(command, function (err) {
                if (err) return sessionAndCBErr(session, err, cb);
                session.progress("Done: git command " + curCmd + "/" + totCmd + ".");
                commands.length > 0 ? runUntilEmpty() : npmInstall(app, session, cb);
            });
        }
        runUntilEmpty();
    });
}

exports.update = function (app, cb) {
    if (app.repository.type === "git") {
        var session = new UpdateSession();
        git(app, session, cb);
        return session;
    }
    cb("Unknown repository type " + app.repository.type);
};
