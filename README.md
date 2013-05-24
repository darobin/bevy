Bevy - A simple server to manage multiple Node services
=======================================================

I love Node, but I have often found deployment to be more painful than it could be. One typically
has to somehow upload the new code, stop the old, restart it, make sure there's a properly
configured proxy in front of it in order to serve off port 80 for a given domain, etc. It's all
surmountable, of course, but it's all pretty repetitive too.

The basic principle of Bevy is simple. It runs as a single proxy service for all of your Node
applications, possibly directly on port 80 so that you don't even have to worry about a world-facing
proxy if you don't want to (Bevy comes with a built-in static file server so that you can also use
it for purely static content). This proxy also exposes a simple REST API that receives configuration
commands that allows it to install, remove, start, stop, list, and describe the applications that
Bevy is running for you. It knows how to fetch an app's content from either git or a local 
directory, and it knows how to run npm in order to install dependencies.

So the idea is this: once you have bevy up and running on a machine (which is trivial and only
requires minimal configuration), all you need to deploy your Node apps is a tiny bit of extra
configuration and a simple command line call.

Installing Bevy
---------------

You probably want to install it globally:

    npm install -g bevy

In order to run the Bevy server reliably, you likely want to use ```forever``` (but you don't have
to if you prefer to use something else). For that:

    npm install -g forever

And that's it.

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
* ```domain```, ```-d```, ```--domain```: The domain to use for the deployment service. Bevy listens
to all incoming requests on its given ports, but one of those domains has to be assigned to the
service that it exposes to manage the apps it is running. Defaults to localhost.
* ```ports```, ```-p```, ```--ports```: The port on which to listen for requests to proxy. Note that
several can be specified (using an array in JSON, and repeated options on the command line). It will
listen to all of the provided ports and proxy in the same way for all. Defaults to 80.
* ```store```, ```-s```, ```--store```: The directory in which Bevy will store the apps that it
manages. Note that this needs to be writable by Bevy. Defaults to a directory called ```bevy-store```
in either your ```$TMPDIR``` or ```/var/tmp```. It is **strongly** recommended to set this to 
another value as you typically want it properly persisted.
* ```username```, ```-u```, ```--username```: Bevy supports very simple authentication for its
service (I nevertheless definitely recommend that you run it behind a tunnel of some form). This
provides the username.
* ```password```, ```--password```: The password to match the username above.
<!-- /bevy-server usage -->

An example configuration file:

    {
        "domain":   "deploy.example.net"
    ,   "ports":    [80, 443]
    ,   "store":    "/users/bevy/store/"
    ,   "username": "robin"
    ,   "password": "fakefake"
    }

The same on the command line:

    forever start bevy-server -d deploy.example.net -p 80 -p 443 -s /users/bevy/store/ \
            -u robin --password fakefake

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
* ```domain```: The domain (just the host) at which you wish to have your app reachable.
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
app is both local and static, Bevy will not copy the files over but rather serve directly from that
directory.
* ```scripts```: This is the standard ```package.json``` scripts object. Bevy uses its ```start```
field to know which application to start. Defaults to ```app.js```.
* ```username```: The username to use when deploying against that server.
* ```password```: The password to use when deploying against that server.

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
* ```--username```: Same as ```username``` in JSON.
* ```--password```: Same as ```password``` in JSON.
<!-- /bevy usage -->


Deploying Bevy Securely
-----------------------

XXX
- security considerations about installing apps, and how to configure the service so that it is
only available via localhost and get to it through a tunnel


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

Note that this can take a while to respond as npm installs dependencies.

### DELETE /app/:name
Stops and deletes the app.

If the app is not found, it returns a 404 with:

    { error: "No app for this name." }

If it fails, it returns a 500 with one of:

    { error: "Failed to stop app, cannot remove: REASON" }
    { error: "Failed to remove app: REASON" }
