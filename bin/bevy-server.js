#!/usr/bin/env node

var nopt = require("nopt")
,   pth = require("path")
,   fs = require("fs")
,   bevy = require("../lib/server")
,   utile = require("utile")
,   knownOpts = {
        config:     String
    ,   domain:     String
    ,   port:       [Number]
    ,   store:      String
    ,   username:   String
    ,   password:   String
    }
,   shortHands = {
        f:      ["--config"]
    ,   d:      ["--domain"]
    ,   p:      ["--port"]
    ,   s:      ["--store"]
    ,   u:      ["--username"]
    }
,   cli = nopt(knownOpts, shortHands, process.argv, 2)
,   configPath = cli.config ? pth.join(process.cwd(), cli.config) : "/etc/bevy/config.json"
,   config = {}
;

// die on error
function die (msg) {
    console.log("[ERROR]", msg);
    process.exit(1);
}

// load the config and override it with CLI parameters
if (fs.existSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, "utf8"));
else if (cli.config) die("Configuration file not found: " + cli.config + "(" + configPath + ")");
config = utile.mixin(config, cli);

// run bevy, run!
bevy.run(config);
