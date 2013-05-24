/*global before, after, describe*/

var expect = require("expect.js")
,   pth = require("path")
,   fs = require("fs")
,   spawn = require("child_process").spawn
,   portfinder = require("portfinder")
,   request = require("request")
,   utile = require("utile")
,   serverPath = pth.join(__dirname, "../bin/bevy-server.js")
,   storePath = pth.join(__dirname, "store")
,   version = require("../package.json").version
,   debug = false
,   server
,   api = "http://localhost:"
;

before(function (done) {
    utile.rimraf(storePath, function () {
        portfinder.getPort(function (err, port) {
            if (err) throw err;
            api += port + "/";
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
            body = JSON.parse(body);
            var count = 0;
            for (var k in body) if (body.hasOwnProperty(k)) count++;
            expect(count).to.equal(0);
            done();
        });
    });

    // check that
    //  we get version from /
    //  we get an empty set of apps

    // XXX
    //  deploy
    //      - a git app
    //      - a local static (and check that it doesn't copy)
    //  start
    //  stop
    //  remove (all)

    // check that after installing an app

});
