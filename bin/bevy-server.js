#!/usr/bin/env node

var nopt = require("nopt")
,   pth = require("path")
,   fs = require("fs")
,   bevy = require("../lib/server")
,   utile = require("utile")
,   knownOpts = {
        config:     String
    ,   domain:     String
    ,   ports:      [Array, Number]
    ,   store:      String
    ,   username:   String
    ,   password:   String
    ,   help:       Boolean
    }
,   shortHands = {
        f:      ["--config"]
    ,   d:      ["--domain"]
    ,   p:      ["--ports"]
    ,   s:      ["--store"]
    ,   u:      ["--username"]
    ,   h:      ["--help"]
    }
,   cli = nopt(knownOpts, shortHands, process.argv, 2)
,   configPath = cli.config ? pth.resolve(process.cwd(), cli.config) : "/etc/bevy/config.json"
,   config = {}
;
delete cli.argv;


// die on error
function die (msg) {
    console.log("[ERROR]", msg);
    process.exit(1);
}

// show usage
function usage () {
    console.log("Usage: bevy-server [OPTIONS]\n");
    var README = fs.readFileSync(pth.join(__dirname, "../README.md"), "utf8");
    README = README.replace(/[\S\s]*<!--\s*bevy-server\s*usage\s*-->/, "")
                   .replace(/<!--\s*\/bevy-server\s*usage\s*-->[\S\s]*/, "")
                   .replace(/```/g, "");
    var options = README.split(/^\* /m);
    options.shift();
    var rex = /^([^:]+):\s*([\S\s]+)/;
    options.forEach(function (opt) {
        var matches = rex.exec(opt)
        ,   prms = matches[1].split(", ")
        ,   out = []
        ;
        prms.forEach(function (prm) {
            if (prm.indexOf("-") > -1) out.push(prm);
        });
        console.log("\t* " + out.join(", ") + ": " + matches[2]);
    });
    process.exit(0);
}

// go to help immediately if requested
if (cli.help) usage();

// load the config and override it with CLI parameters
if (fs.existsSync(configPath)) config = JSON.parse(fs.readFileSync(configPath, "utf8"));
else if (cli.config) die("Configuration file not found: " + cli.config + " (resolved to " + configPath + ")");
config = utile.mixin(config, cli);

// run bevy, run!
bevy.run(config);
