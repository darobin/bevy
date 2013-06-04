#!/usr/bin/env node

var nopt = require("nopt")
,   pth = require("path")
,   fs = require("fs")
,   bevy = require("../lib/server")
,   cliUtils = require("../lib/cli-utils")
,   utile = require("utile")
,   knownOpts = {
        config:     String
    ,   domain:     String
    ,   ports:      [Array, Number]
    ,   store:      String
    ,   help:       Boolean
    }
,   shortHands = {
        f:      ["--config"]
    ,   d:      ["--domain"]
    ,   p:      ["--ports"]
    ,   s:      ["--store"]
    ,   h:      ["--help"]
    }
,   cli = nopt(knownOpts, shortHands, process.argv, 2)
,   configPath = cli.config ? pth.resolve(process.cwd(), cli.config) : "/etc/bevy/config.json"
,   config = {}
;
delete cli.argv;

// go to help immediately if requested
if (cli.help) cliUtils.usage("bevy-server [OPTIONS]", "bevy-server");

// load the config and override it with CLI parameters
if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, "utf8"));
else if (cli.config) cliUtils.die("Configuration file not found: " + cli.config + " (resolved to " + configPath + ")");
config = utile.mixin(config, cli);

// run bevy, run!
bevy.run(config);
