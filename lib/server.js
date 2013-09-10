/*jshint es5: true */

var forever = require("forever-monitor")
,   proxima = require("proxima")
,   portfinder = require("portfinder")
,   express = require("express")
,   repo = require("./repo")
,   touch = require("touch")
,   utile = require("utile")
,   deepEquals = require("deep-equal")
,   pth = require("path")
,   fs = require("fs")
,   os = require("os")
,   version = require("../package.json").version
,   staticServerPath = pth.join(__dirname, "static-server.js")
;

function Bevy (conf) {
    var apps = {}
    ,   spawns = {}
    ,   sessions = {}
    ;
    if (!conf) conf = {};

    // load configuration
    var conf = utile.mixin({
        domain:     "localhost"
    ,   ports:      [80]
    ,   store:      pth.join(process.env.TMPDIR || "/var/tmp", "bevy-store")
    ,   basePort:   7000
    ,   security:   "local"
    }, conf);
    if (!utile.isArray(conf.ports)) conf.ports = [conf.ports];
    if (conf.uid) conf.uid = +conf.uid;
    if (conf.gid) conf.gid = +conf.gid;
    portfinder.basePort = conf.basePort;

    // set up proxy
    var proxy = proxima.Server.create()
                    .set404(true)
                    .set500(true)
                    .set504(true)
                    ;

    conf.ports.forEach(function (port) {
        if (typeof port === "string" && port.indexOf("s") === 0) {
            port = 1 * port.replace("s", "");
            proxy.listen(port, null, true);
        }
        else proxy.listen(port);
    });

    // dynamically adds/removes a route to the proxy
    function addAppRoute (domain, options) {
        console.log(domain, options);
        proxy.addRoute(domain, options);
    }
    function removeAppRoute (domain) {
        proxy.removeRoute(domain);
    }

    // handle errors (this needs improvement)
    function error (msg, obj) {
        console.log("[ERROR]", msg, obj);
        process.exit(1);
    }

    // get a free port
    function getPort (cb) {
        portfinder.getPort(function (err, port) {
            // next time, start the search there
            if (port) portfinder.basePort = port + 1;
            cb(err, port);
        });
    }

    // launch a child
    function startChild (childConf) {
        var foreverConf = {
            env:        {
                PORT:           childConf.port
            ,   BEVY_ROOT:      childConf.cwd
            ,   NODE_ENV:       childConf.env || "development"
            ,   BEVY_CONFIG:    childConf.configPath
            }
        ,   cwd:        childConf.cwd
        ,   logFile:    pth.join(childConf.logPath, "forever.log")
        ,   outFile:    pth.join(childConf.logPath, "access.log")
        ,   errFile:    pth.join(childConf.logPath, "error.log")
        };
        if (conf.uid || conf.gid) foreverConf.spawnWith = {};
        if (conf.uid) foreverConf.spawnWith.uid = conf.uid;
        if (conf.gid) foreverConf.spawnWith.gid = conf.gid;
        if (!fs.existsSync(childConf.cwd)) {
            console.log("[ERROR] Path (cwd) for app does not exist: " + childConf.cwd);
            return;
        }
        return new forever.Monitor(childConf.startPath, foreverConf);
    }

    // spawn an app
    function spawnApp (app, cb) {
        if (!cb) cb = function (err) {
            if (err) return console.log("[ERROR]" + err);
        };
        if (app.to) { // just use proxima as a proxy
            addAppRoute(app.domain, app.to);
            app.running = true;
            return cb();
        }
        getPort(function (err, port) {
            if (err) return cb(err);
            var childConf = {
                    configPath: app.configPath
                ,   port:       port
                ,   logPath:    app.storePath
            };
            if (app.static) {
                childConf.startPath = staticServerPath;
            }
            else {
                childConf.startPath = app.startPath;
            }
            childConf.cwd = app.contentPath;
            var child = startChild(childConf);
            if (!child) return cb("[ERROR] Failed to instantiate application '" + app.name + "', skipping.");
            spawns[app.name] = child;
            child.on("error", function (err) {
                var msg = "[ERROR] Unexpected error in app " + app.name;
                console.log(msg, err);
                cb(msg);
            });
            child.start();
            addAppRoute(app.domain, { port: port });
            app.running = true;
            app.port = port;
            touch(app.runningPath, cb);
        });
    }

    // stop an app
    function stopApp (app, cb) {
        if (!app.to) {
            var child = spawns[app.name];
            if (!child) return cb(null);
            child.stop();
            delete spawns[app.name];
        }
        removeAppRoute(app.domain);
        app.running = false;
        if (fs.existsSync(app.runningPath)) fs.unlinkSync(app.runningPath);
        cb(null);
    }
    
    function restartApp (app, cb) {
        stopApp(app, function (err) {
            if (err) return cb(err);
            spawnApp(app, cb);
        });
    }

    // update an app
    //  note that this does not start an app upon installation
    function updateApp (app, cb) {
        if (!fs.existsSync(app.storePath)) fs.mkdirSync(app.storePath);
        // if you change the repository source, for now you have to remove and re-add
        // at some point we should support doing this transparently, in the meantime
        // the right thing to do is to tell the user that it won't work
        if (apps[app.name] && !deepEquals(apps[app.name].repository, app.repository)) {
            return cb("When changing the repository, you must remove and re-add the app.");
        }

        fs.writeFileSync(app.configPath, JSON.stringify(app, null, 4));
        
        if (app.to) return cb(null);

        function restartAndOk () {
            // if it was running, restart it (but not otherwise)
            var child = spawns[app.name];
            if (child) restartApp(app, cb);
            else cb(null);
        }

        // if app is local, no need to copy over the content
        if (app.repository.type === "local") {
            restartAndOk();
        }
        else {
            var session = repo.update(app, conf, function (err) {
                if (err) return cb(err);
                cb = function () {}; // restart errors are not signalled properly
                restartAndOk();
            });
            sessions[session.id] = session;
            cb(null, session);
        }
    }

    // launch the configuration API
    function startAPI (port) {
        var app = express();
        app.enable("trust proxy");
        app.enable("case sensitive routing");

        // middleware
        app.use(express.logger());
        app.use(express.bodyParser());
        app.use("/", express.static(pth.join(__dirname, "../ui")));

        // security
        var ownIPs = {}
        ,   ifaces = os.networkInterfaces()
        ;
        for (var k in ifaces) {
            for (var i = 0, n = ifaces[k].length; i < n; i++) {
                ownIPs[ifaces[k][i].address] = true;
            }
        }
        app.use(function (req, res, next) {
            if (conf.security === "none") return next();
            if (!ownIPs[req.ip]) {
                return res.send(403, "You are not allowed to connect to this service. Logged: " + req.ip);
            }
            next();
        });

        // GET /
        // server info
        app.get("/version", function (req, res) {
            res.json({ bevy: version });
        });

        // GET /apps
        // lists all the apps
        app.get("/apps", function (req, res) {
            res.json(apps);
        });

        // select the app
        function pickApp (req, res, next) {
            var name = req.params.name;
            if (!apps[name]) return res.json(404, { error: "No app for this name." });
            req.bevyApp = apps[name];
            next();
        }

        // GET /app/app-name
        // list that app
        app.get("/app/:name", pickApp, function (req, res) {
            res.json(req.bevyApp);
        });

        function simpleResponse (res) {
            return function (err) {
                if (err) return res.json(500, { error: err });
                res.json({ ok: true });
            };
        }

        // POST /app/app-name/start
        // starts the app
        app.post("/app/:name/start", pickApp, function (req, res) {
            if (req.bevyApp.running) return res.json(418, { error: "App already running." });
            spawnApp(req.bevyApp, simpleResponse(res));
        });

        // POST /app/app-name/stop
        // stops the app
        app.post("/app/:name/stop", pickApp, function (req, res) {
            if (!req.bevyApp.running) return res.json(418, { error: "App already stopped." });
            stopApp(req.bevyApp, simpleResponse(res));
        });

        function sessionReponse (res) {
            return function (err, session) {
                if (err) return res.json(500, { error: err });
                if (!session) return res.json({ ok: true });
                res.json(202, { session: true, id: session.id, path: "/session/" + session.id });
            };
        }

        // POST /app/app-name/update
        // causes the source of the app to update from the repo
        app.post("/app/:name/update", pickApp, function (req, res) {
            updateApp(req.bevyApp, sessionReponse(res));
        });

        // PUT /app/app-name
        //     create or update a new app, with JSON
        //     {
        //         environment:    dev|prod|test
        //     ,   domain:      "foo.bast"
        //     ,   dependencies:   {}
        //     ,   repository: {
        //             type:   "git"
        //         ,   url:    "..."
        //         }
        //     ,   scripts:    {
        //             start:  "start-script.js" // default to app.js
        //         }
        //      ,   static:     true|false
        //     }
        app.put("/app/:name", function (req, res) {
            var name = req.params.name
            ,   desc = req.body;
            if (!/^[a-zA-Z0-9-_]+$/.test(name)) return res.json(400, { error: "Bad name, rule: /^[a-zA-Z0-9-_]+$/." });
            if (!desc) return res.json(400, { error: "No JSON configuration provided." });
            if (!desc.repository) return res.json(400, { error: "Field 'repository' required." });
            if (!desc.domain) return res.json(400, { error: "Field 'domain' required." });
            if (!desc.repository.type) desc.repository.type = "git";
            if (!desc.static) {
                if (!desc.dependencies) desc.dependencies = {};
                if (!desc.environment) desc.environment = "dev";
                if (!desc.scripts) desc.scripts = {};
                if (!desc.scripts.start) desc.scripts.start = "app.js";
            }
            desc.running = apps[name] ? apps[name].running : false;
            apps[name] = desc;
            desc.name = name;
            desc.storePath = pth.join(conf.store, name);
            desc.configPath = pth.join(desc.storePath, "config.json");
            desc.runningPath = pth.join(desc.storePath, "RUNNING");
            desc.contentPath = (desc.repository.type === "local") ? desc.repository.path : pth.join(desc.storePath, "content");
            if (!desc.static) desc.startPath = pth.join(desc.contentPath, desc.scripts.start);
            updateApp(desc, sessionReponse(res));
        });

        // DELETE /app/app-name
        // stops and deletes the app
        app.del("/app/:name", pickApp, function (req, res) {
            var app = req.bevyApp;
            stopApp(app, function (err) {
                if (err) return res.json(500, { error: "Failed to stop app, cannot remove: " + err });
                utile.rimraf(app.storePath, function (err) {
                    if (err) return res.json(500, { error: "Failed to remove app: " + err });
                    delete apps[app.name];
                    res.json({ ok: true });
                });
            });
        });

        // GET /session/:id
        // returns the last messages of a session for a long-running job (e.g npm)
        // this is meant for polling
        app.get("/session/:id", function (req, res) {
            var id = req.params.id
            ,   session = sessions[id]
            ;
            if (!session) return res.json(404, { error: "No such running session." });
            if (session === "done") return res.json({ done: true });
            res.json({ messages: session.messages() });
            if (session.done) sessions[id] = "done";
        });

        app.listen(port);

        // load existing apps from store
        //  the store is created if it doesn't exist
        //  inside the store, each directory that contains a "config.json" is an app
        //  if the app directory contains a "RUNNING" file, then it's running
        //  the app directory has a content directory that's the app's content and has a name that
        //      depends on the repo type
        if (!fs.existsSync(conf.store)) fs.mkdirSync(conf.store);
        fs.readdir(conf.store, function (err, files) {
            if (err) return error("Failed to read directory " + conf.store, err);
            files.forEach(function (name) {
                var dir = pth.join(conf.store, name);
                fs.stat(dir, function (err, stat) {
                    if (err) return error("Failed to stat directory " + dir, err);
                    if (!stat.isDirectory()) return;
                    var configPath = pth.join(dir, "config.json")
                    ,   runningPath = pth.join(dir, "RUNNING")
                    ,   running = fs.existsSync(runningPath);
                    if (!fs.existsSync(configPath)) return;
                    fs.readFile(configPath, function (err, data) {
                        if (err) return error("Could not read app configuration " + configPath, err);
                        var appConfig;
                        try {
                            appConfig = JSON.parse(data);
                        }
                        catch (e) {
                            return error("Failed to parse app configuration" + configPath, err);
                        }
                        apps[name] = appConfig;
                        if (running) spawnApp(appConfig);
                    });
                });
            });
            console.log("Bevy up, management API available on port(s) ", conf.ports);
        });
    }

    // add the local service as an app
    getPort(function (err, port) {
        if (err) return error("Failed to assign port", err);
        addAppRoute(conf.domain, { port: port });
        startAPI(port);
    });
}

exports.run = function (conf) {
    return new Bevy(conf);
};
