#!/usr/bin/env node

var forever = require("forever-monitor")
,   pth = require("path")
,   MAX_RESTARTS = 100
;

// XXX actually I reckon that this is useless, and should be run with
// forever directly
// we just need a small bin script that requires and runs it

// XXX this needs to make sure the configuration is available
var child = new forever.Monitor(pth.join(__dirname, "../lib/server.js"), {
    max:    MAX_RESTARTS
});
child.on("exit", function () {
    console.log("Maximal number of restarts for bevy-server hit (" + MAX_RESTARTS + "), stopped.");
});
child.start();
