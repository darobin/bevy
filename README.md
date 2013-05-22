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

* ```-f path```, ```--config path```: The path to a configuration file to use, possibly relative.
* ```domain```, ```-d```, ```--domain```: The domain to use for the deployment service. Bevy listens
to all incoming requests on its given ports, but one of those domains has to be assigned to the
service that it exposes to manage the apps it is running. Required.
* ```ports```, ```-p```, ```--port```: The port on which to listen for requests to proxy. Note that
several can be specified (using an array in JSON, and repeated options on the command line). It will
listen to all of the provided ports and proxy in the same way for all. Defaults to 80.
* ```store```, ```-s```, ```--store```: The directory in which Bevy will store the apps that it
manages. Note that this needs to be writable by Bevy. Required.
* ```username```, ```-u```, ```--username```: Bevy supports very simple authentication for its
service (I nevertheless definitely recommend that you run it behind a tunnel of some form). This
provides the username.
* ```password```, ```--password```: The password to match the username above.

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

The options, which must come after the action, are the following:

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


XXX
- we need a way to convey the selected environment to the Bevy server, and then for the Bevy server
to run the app under the right NODE_ENV.
- document the REST API. Explain why it's not all that REST.


