Bevy - A simple server to manage multiple Node services
=======================================================

[![NPM version](https://badge.fury.io/js/bevy.png)](http://badge.fury.io/js/bevy)
<!-- [![Build Status](https://travis-ci.org/darobin/bevy.png)](https://travis-ci.org/darobin/bevy) -->

I love Node, but I have often found deployment to be more painful than it could be. One typically
has to somehow upload the new code, stop the old, restart it, make sure there's a properly
configured proxy in front of it in order to serve off port 80 for a given domain, etc. It's all
surmountable, of course, but it's all pretty repetitive too.

The basic principle of Bevy is simple. It runs as a single proxy service for all of your Node
applications, possibly directly on port 80 so that you don't even have to worry about a world-facing
proxy if you don't want to (Bevy comes with a built-in static file server so that you can also use
it for purely static content). This proxy also exposes a simple REST API that receives configuration
commands that allow it to install, remove, start, stop, list, and describe the applications that
Bevy is running for you. It knows how to fetch an app's content from either git or a local 
directory, and it knows how to run npm in order to install dependencies from your repository.

So the idea is this: once you have bevy up and running on a machine (which is trivial and only
requires minimal configuration), all you need to deploy your Node apps is a tiny bit of extra
configuration and a simple command line call.

Bevy works with HTTP, HTTPS, and Web Sockets.

Installing Bevy
---------------

You probably want to install it globally:

    npm install -g bevy

In order to run the Bevy server reliably, you likely want to use ```forever``` (but you don't have
to if you prefer to use something else). For that:

    npm install -g forever

And that's it.

Examples
--------

I strongly recommend you get familiar with the entirety of this document before you deploy Bevy,
but if you want to play with simple examples to get a feel for it you can simply look in the
examples directory.

Running the Bevy server
-----------------------

The Bevy server is the part responsible for both managing your apps and for proxying to them. You
run it thus:

    bevy-server

If you want to run Bevy as a permanent daemon, it is recommend that you start it with ```forever```:

    forever start bevy-server

Bevy does however require a few configuration parameters in order to work. These can either be
specified on the command line, in ```/etc/bevy/config.json```, or in a JSON configuration file
provided using the ```-f``` option. The configuration parameters (including JSON keys where 
applicable) are as follows:

<!-- bevy-server usage -->
* ```-h```, ```--help```: Show this usage.
* ```-f path```, ```--config path```: The path to a configuration file to use, possibly relative.
* ```domain```, ```-d```, ```--domain```: The domain to use for the deployment service (i.e. the
REST API which Bevy exposes, not for the services being proxied to — those are set up by the
client). Bevy listens to all incoming requests on its given ports, but one of those domains has to
be assigned to the service that it exposes to manage the apps it is running. Defaults to
localhost.
* ```ports```, ```-p```, ```--ports```: The port on which to listen for requests to proxy. Note that
several can be specified (using an array in JSON, and repeated options on the command line). It will
listen to all of the provided ports and proxy in the same way for all (except that secure ports only
trigger on HTTPS and the rest only on HTTP). If you wish to listen to a secure port for HTTPS, then
prefix it with "s". Defaults to [80].
* ```store```, ```-s```, ```--store```: The directory in which Bevy will store the apps that it
manages. Note that this needs to be writable by Bevy. Defaults to a directory called ```bevy-store```
in either your ```$TMPDIR``` or ```/var/tmp```. It is **strongly** recommended to set this to 
another value as you typically want it properly persisted.
* ```security```, ```--security```: The default security setup for Bevy is to only accept 
connections to its management API coming from the local machine, corresponding to the
value ```local```. This can be set to ```none``` to disable this check. **BE VERY CAREFUL** as this
effectively enables anyone who can reach the server to install and run arbitrary software on the
machine.
* ```uid```, ```-u```, ```--uid```: The user id under which to run spawned processes. If you are
running Bevy as root (which is required on many platforms in order to be able to listen on ports
lower than 1024) then it is highly recommended to set this option to a user with lower privileges.
Otherwise not only will the spawned services be running as root, but also git and npm, as well as
whatever script npm runs. Note that due to limitations in Node's API this has to be the numeric
uid (use ```id -u username``` to get it).
* ```gid```, ```-g```, ```--gid```: Same as the previous one, but for the group id. Note that due to
limitations in Node's API this has to be the numeric gid (use ```id -g username``` to get it).
<!-- /bevy-server usage -->

An example configuration file:

    {
        "domain":   "deploy.example.net"
    ,   "ports":    [80, "s443"]
    ,   "store":    "/users/bevy/store/"
    ,   "uid":      501
    ,   "gid":      20
    }

The same on the command line:

    forever start bevy-server -d deploy.example.net -p 80 -p s443 -s /users/bevy/store/ \
                              -u 501 -g 20

You can mix and match the configuration file and command line parameters; the latter will take
priority.

Deploying an app with Bevy
--------------------------

In order to deploy an application with Bevy you use the ```bevy``` command. This command can
deploy, remove, start, and stop bevy apps in a given Bevy server. It gets its information from the
app's ```package.json``` file, optionally supplemented by information in a similar ```bevy.json```
file or on the command line.

It takes the following fields into account:

* ```deploy```: The URL (including scheme and port) of the Bevy server to deploy to. Required.
* ```name```: This is the standard ```package.json``` name field; Bevy uses this to provide your
app with a unique ID on the server. Required.
* ```domain```: The domain (just the host) at which you wish to have your app reachable. If the
domain begins and ends with "/" it is interpreted as a regular expression; otherwise it's a glob. In
globs, the * character matches any number of characters with no restrictions, and the ? character
matches everything except separators (. or :).
* ```dependencies```: This is the standard ```package.json``` dependencies field; Bevy uses this to
tell npm what to install. Defaults to none.
* ```static```: A boolean that when true indicates that this project is actually static so that no
Node app should be run. This is useful in case you have a shared server running lots of little sites
some of which are static, and you don't want to set up a proxy in front of Bevy.
* ```repository```: This is an object that specifies where to get the content for the app. Required.
It supports the following fields:
    * ```type```: This has to be ```git``` or ```local```.
    * ```url```: Applies to type ```git```, provides a Git URL or path for the repository. Required.
    * ```branch```: Applies to type ```git```, indicates which branch to use. Defaults to whatever the
default branch in that repository is.
    * ```path```: Applies to type ```local```, gives the file system path to use. Note that when an
app is both local, Bevy will not copy the files over but rather serve directly from that directory.
This includes not running npm to install dependencies; if you're pointing at a local directory it is
up to you to do so (the primary use for ```local``` is development, where this is what you expect).
* ```scripts```: This is the standard ```package.json``` scripts object. Bevy uses its ```start```
field to know which application to start. Defaults to ```app.js```.
* ```directoryIndex```: Applies only to static servers, this provides a list of file names to use
to select the directory index. It defaults to ```index.html```.

The way Bevy obtains that information is as follows:

1. It reads the ```package.json``` file, if any (highly recommended).
2. It reads the ```bevy.json``` file, if any. The values found there overwrite existing ones. This
makes it possible to keep your Bevy-specific information out of ```package.json``` if it is used
for other things as well, or for instance if you want to use a different ```name``` in each.
3. If there was a ```bevy.json``` file, and it contained a key matching the selected environment
(i.e. ```development``` or ```production```) then it will take the values there and overwrite the
existing ones. Typically this can be used to select a different deployment server for different
environments.
4. If there were command line parameters, they override the values found up to here.

The general syntax of the ```bevy``` command is:

    bevy action [options]

The actions are:

* ```deploy```: Deploys the app. This installs it if it wasn't installed, updates it otherwise, then
starts it.
* ```start```: Starts the app.
* ```stop```: Stops the app.
* ```remove```: Removes the app. Note that this can be somewhat destructive, it will remove logs
(as well as anything that your app may have stored under its running directory).
* ```stage```: Deploys the app using the configuration for the "development" environment but setting
the runtime environment to "production". This allows you to run code on your development deployment
under production conditions.
* ```help```: Get help.

The options, which must come after the action, are the following:

<!-- bevy usage -->
* ```--package```: The path to the ```package.json``` to load. Defaults to the current directory.
* ```--bevy```: The path to the ```bevy.json``` to load. Defaults to the current directory.
* ```--env```: The environment under which to run. Defaults to development.
* ```--deploy```: Same as ```deploy``` in JSON.
* ```--name```: Same as ```name``` in JSON.
* ```--domain```: Same as ```domain``` in JSON.
* ```--static```: A flag, same as ```static``` in JSON.
* ```--type```: Same as ```repository.type``` in JSON.
* ```--url```: Same as ```repository.url``` in JSON.
* ```--branch```: Same as ```repository.branch``` in JSON.
* ```--path```: Same as ```repository.path``` in JSON.
* ```--start```: Same as ```scripts.start``` in JSON.
<!-- /bevy usage -->


Deploying Bevy Securely
-----------------------

Bevy is a system that allows you to install and run software that can perform arbitrary operations,
over the network. Read that again. Make sure you get this. This section isn't something you want to
read in the future, as a nice-to-have, feel-good extra. You **have** to read it.

By default, Bevy's app management API only accepts connections coming from an IP on the local 
machine. On the face of it, this makes the API a whole lot less useful if you're on your 
development machine and want to deploy to production. One simple way of doing that is explained
further below.

Note that there is an option to disable this security check entirely. It is there so that people who
know what they are doing can do so. For instance, you could consider using it on a machine that is
well protected inside your own network. But only do so **very** carefully. Note that binding the
API to ```localhost``` is not enough to protect you; if I know the IP I can still reach it and
specify ```Host: localhost``` to fool the server.

The simplest way to set Bevy up on a production, world-accessible server is to:

1. Stick to ```localhost``` (or whatever local domain) for the server.
2. Keep the above security check on (it is by default).
3. Use an SSH tunnel from your development box to the server. That's pretty easy.

The way in which you set up an SSH tunnel is as follows (assuming you already have SSH access to
the server). Run:

    ssh -f your-user@your-server.com -L 2000:your-server.com:80 -N

What the above does is that it creates a tunnel from ```localhost:2000``` to 
```your-server.com:80``` through an SSH connection that identifies you as ```your-user``` to the
server. You can naturally change your user, the remote server, and the ports you use. You can save
that command, run it at start up, etc.

With the above setup, your deployment target simply becomes ```http://localhost:2000/```. When Bevy
talks to that URL, it will be talking to the remote server.

Another important security-related aspect to take into account are the uid/gid settings. As 
explained in the configuration section, if these are unset and you are running as root (which is
often required), then not only spawned services but also git and npm will run as root. Needless to
say, this can be a large attack vector.

Bevy and HTTPS
--------------

Bevy dispatches HTTPS connections based on SNI. The advantage here is that you do not need to muck
with certs at the Bevy level and only set that up in your application — proxying will just work. The
downside is that SNI is not supported in some old clients (XP, IE less than 7, Android browser less
than 3). For those, either provide an HTTP endpoint, or send in a pull request to support HTTPS
more directly.

Bevy and Web Sockets
--------------------

Bevy uses [proxima](https://github.com/BlueJeansAndRain/proxima/) under the hood and so mirrors its
support for Web Sockets. Essentially, since the negotiation phase in the WS protocol is HTTP-based,
Bevy simply proxies based on that and afterwards the connection should be transparently relayed.

REST API
--------

The REST API exposed to manage applications would be better described as an HTTP API because it's
not in fact all that RESTful. Where it made sense, I elected to go with simplicity of interaction
(e.g. just entering a URL in the browser bar) over "correctness". I don't believe that anything is
lost here, except perhaps RESTafarian brownie points. I can live without those.

All interactions involve JSON.

### GET /
Provides the server information. Mostly useful to check that it's running.
Always returns the version:

    { bevy: "0.2.42" }

### GET /apps
Lists all the apps, keyed by name. The value for each is an object describing the application that
corresponds to the app's configuration as provided during deployment (typically, as resolved
by ```bevy```). Additionally, it contains a ```running``` boolean indicating whether the app is
running or not, a number of paths that are used in running the app, and the port that it uses. Apart
from ```running```, you shouldn't need any of that information but it can come in handy for
debugging purposes.

Example response:

    {
      "first-test": {
        "name": "first-test",
        "version": "0.0.1",
        "domain": "first-test.local",
        "dependencies": {
          "express": "*",
          "eyes": "*"
        },
        "repository": {
          "type": "git",
          "url": "/Projects/bevy/scratch/one"
        },
        "scripts": {
          "start": "app.js"
        },
        "environment": "dev",
        "running": true,
        "storePath": "/var/folders/p4/1wzy444j5tbg__5kj1nt8lxr0000gn/T/bevy-store/first-test",
        "configPath": "/var/folders/p4/1wzy444j5tbg__5kj1nt8lxr0000gn/T/bevy-store/first-test/config.json",
        "runningPath": "/var/folders/p4/1wzy444j5tbg__5kj1nt8lxr0000gn/T/bevy-store/first-test/RUNNING",
        "contentPath": "/var/folders/p4/1wzy444j5tbg__5kj1nt8lxr0000gn/T/bevy-store/first-test/content",
        "startPath": "/var/folders/p4/1wzy444j5tbg__5kj1nt8lxr0000gn/T/bevy-store/first-test/content/app.js",
        "port": 7001
      }
    }

### GET /app/:name
Returns the same information as the previous operation, but just for one app with the given name.

If the app is not found, it returns a 404 with:

    { error: "No app for this name." }

If successful, it will return the same JSON as above, below the corresponding app name key.

### GET /app/:name/start
Starts the app.

If the app is not found, it returns a 404 with:

    { error: "No app for this name." }

If the app was already running, it returns a 418 with:

    { error: "App already running." }

For all other errors, it returns a 500 with the ```error``` field set to whatever error the
system provided.

### GET /app/:name/stop
Stops the app

If the app is not found, it returns a 404 with:

    { error: "No app for this name." }

If the app was already running, it returns a 418 with:

    { error: "App already stopped." }

For all other errors, it returns a 500 with the ```error``` field set to whatever error the
system provided.

### GET /app/:name/update
Causes the source of the app to update from the repo (pull it through git, or copying files), and
the app to then be restarted. This can be quite long, especially if npm installs a number of new
dependencies.

If the app is not found, it returns a 404 with:

    { error: "No app for this name." }

For all other errors, it returns a 500 with the ```error``` field set to whatever error the
system provided.

The success response for this method can take two forms. If the app is a simple local application
that does not require a possibly long-running operation (such as git cloning or npm install) then
it will immediately reply with status ```200 OK``` and a ```{ "ok": true }``` as the body.

If however the request involves a long running process, then it will reply with status
```202 Accepted```. The response body will be JSON similar to the following:

    {
        "session":  true
    ,   "id":       "PTBjY3J3tM"
    ,   "path":     "/session/PTBjY3J3tM"
    }

The ```id``` (or the ```path```) can then be used with the session API described below in order to
poll the server about its progress in carrying out the update.

### PUT /app/:name
Create or update the configuration of an app. The body of the request must be the desired
configuration (as described in the previous section).

If the app was already running, then it is restarted. However, if it was not, or if this is a fresh
install, then the application is **not** started. (The command line tool does that for you on 
install, though.)

If the name does not match ```/^[a-zA-Z0-9-_]+$/```, it returns a 400 with:

    { error: "Bad name, rule: /^[a-zA-Z0-9-_]+$/." }

If no configuration is provided, it returns a 400 with:

    { error: "No JSON configuration provided." }

If the ```repository``` or ```domain``` fields are missing, it returns a 400 with:

    { error: "Field 'XXX' required." }

For all other errors, it returns a 500 with the ```error``` field set to whatever error the
system provided.

The response is the same as for the previous method.

### DELETE /app/:name
Stops and deletes the app.

If the app is not found, it returns a 404 with:

    { error: "No app for this name." }

If it fails, it returns a 500 with one of:

    { error: "Failed to stop app, cannot remove: REASON" }
    { error: "Failed to remove app: REASON" }

### GET /session/:id
Query as specific session corresponding to a long-running backend process (npm, git). This is
used by the client in order to poll ongoing progress. Several different responses can be received:

If there is no such session, a 404 error. Note that when a session terminates, it will continue to
respond with 200 until the Bevy server is restarted. This means that you should never get a 404 out
of your polling, even when the session has terminated (unless the server has been restarted, which
is unlikely).

If there is such a session, the response is 200 with a body that depends on the status of the
session.

If the session is finished, you just receive ```{ done: true }```. If it is running, you will get
```{ messages: [array, of, messages]}```.

Each message is an array with a type as its first value and optionally a string as its second value.
If the key is ```progress```, it is a progress message and the accompanying string will be a human
description of the progress event. If the key is ```error```, it is an error message and the 
accompanying string will be whatever error message could be gathered. Errors typically lead to the
termination of the session. Finally, if the key is ```end```, there is no accompanying string and
it indicates that this will be the last message of the session (it will soon be flagged as done if
it hasn't already).

Note that whenever you ask for a session, the messages that are returned to you are removed from the
queue of messages that Bevy is maintaining. Therefore, you will never get the same message twice and
can safely just display them when polling multiple times without being concerned that you may show
a given message more than once.

It is possible for the array of messages to be empty if nothing at all has happened since you last 
polled.
