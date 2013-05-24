/*global before, after, describe*/

var expect = require("expect.js")
,   pth = require("path")
,   fs = require("fs")
,   spawn = require("child_process").spawn
,   exec = require("child_process").exec
,   portfinder = require("portfinder")
,   request = require("request")
,   utile = require("utile")
,   serverPath = pth.join(__dirname, "../bin/bevy-server.js")
,   bevyPath = pth.join(__dirname, "../bin/bevy.js")
,   storePath = pth.join(__dirname, "store")
,   version = require("../package.json").version
,   debug = false
,   server
,   deployPort
,   api = "http://localhost:"
;

before(function (done) {
    utile.rimraf(storePath, function () {
        portfinder.getPort(function (err, port) {
            if (err) throw err;
            api += port + "/";
            deployPort = port;
            server = spawn(serverPath, ["-d", "localhost"
                                    ,   "-p", port
                                    ,   "-s", storePath
                                    ]);
            if (debug) {
                server.stdout.on("data", function (data) { console.log("[SERVER OUT]", data.toString()); });
                server.stderr.on("data", function (data) { console.log("[SERVER OUT]", data.toString()); });
                server.on("exit", function (code, sig) { console.log("[SERVER EXIT]", code, sig); });
                server.on("error", function (err) { console.log("[SERVER ERROR]", err); });
            }
            var seen = false;
            server.stdout.on("data", function () {
                if (seen) return;
                seen = true;
                done();
            });
        });
    });
});

after(function (done) {
    if (server) server.kill("SIGTERM");
    done();
});


describe("Server basics", function () {
    it("creates a store", function () {
        expect(fs.existsSync(storePath)).to.be.ok();
    });

    it("starts a basic server", function (done) {
        request.get(api,function (err, res, body) {
            body = JSON.parse(body);
            expect(body.bevy).to.equal(version);
            done();
        });
    });

    it("has no apps", function (done) {
        request.get(api + "apps", function (err, res, body) {
            expect(err).to.be(null);
            body = JSON.parse(body);
            var count = 0;
            for (var k in body) if (body.hasOwnProperty(k)) count++;
            expect(count).to.equal(0);
            done();
        });
    });
});

describe("Static server", function () {
    var oldDir = process.cwd();
    before(function (done) {
        var staticDir = pth.join(__dirname, "static");
        process.chdir(staticDir);
        exec(bevyPath + " deploy --deploy " + api + " --path " + staticDir, function (err, stdout, stderr) {
            if (stdout) console.log("[STDOUT]", stdout);
            if (stderr) console.log("[STDERR]", stderr);
            done();
        });
    });
    after(function () {
        process.chdir(oldDir);
    });
    it("serves basic content", function (done) {
        request.get("http://127.0.0.1:" + deployPort, function (err, res, body) {
            expect(err).to.be(null);
            expect(body).to.equal("<h1>ohai!</h1>\n");
            done();
        });
    });
});


// XXX
//  deploy
//      - a git app
//      - a local static (and check that it doesn't copy)
//  stop
//  start
//  remove (all)

// check that after installing an app the apps list changes

