
// a fair amount of this stuff is stolen from haibu
var fs = require("fs")
,   exec = require("child_process").exec
,   npm = require("npm")
,   npmConfig = {
        _exit:          false
    ,   exit:           false
    ,   "unsafe-perm":  true
    ,   loglevel:       "silent"
    ,   production:     true
    }
;

function npmInstall (app, cb) {
    npm.load(npmConfig, function (err) {
        if (err) return cb(err);
        var what = [];
        Object.keys(app.dependencies).forEach(function (k) {
            what.push(k + "@" + app.dependencies[k]);
        });
        npm.commands.install(app.storePath, what, function (err) {
            cb(err);
        });
    });
}

function git (app, cb) {
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
        
        function runUntilEmpty () {
            var command = commands.shift();
            exec(command, function (err) {
                if (err) return cb(err);
                commands.length > 0 ? runUntilEmpty() : npmInstall(app, cb);
            });
        }
        runUntilEmpty();
    });
}

exports.update = function (app, cb) {
    if (app.repository.type === "git") return git(app, cb);
    cb("Unknown repository type " + app.repository.type);
};

