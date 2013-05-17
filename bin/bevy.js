#!/usr/bin/env node

var forever = require("forever-monitor")
,   pth = require("path")
,   MAX_RESTARTS = 100
;

var child = new forever.Monitor(pth.join(__dirname, "../lib/bevy-server.js"), {
    max:    MAX_RESTARTS
});
child.on("exit", function () {
    console.log("Maximal number of restarts for bevy-server hit (" + MAX_RESTARTS + "), stopped.");
});
child.start();
