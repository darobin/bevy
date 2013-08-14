
# Running a Node site with Bevy

First, start a toy bevy-server instance from inside a clone of this repository on a free port (if
you pick a different port, change the deploy field in bevy.json):

    node ../../bin/bevy-server.js -d localhost -p 8042 -s /var/tmp

You can check that it's running at http://localhost:8042/.

Second, change bevy.json here so that path points to this directory.

Note that in order to make this example truly easy to run, we consider that your domain name is
"127.0.0.1", which is unrealistic but saves you from having to configure anything locally. If you
have a hostname (other than localhost, which is used for the bevy endpoint above) that points to
your local machine you can use that instead.

Now make sure that you have all the dependencies for the app:

    npm install -d
    
Again, in this case Bevy does not install the dependencies for you because the source for the app
is a local directory rather than a git repository. In a more realistic scenario, such as deploying
to a remote server, Bevy would fetch the content of your app from git and install the dependencies
you need.

Run:

    node ../../bin/bevy.js deploy

You can see that it's configured at http://localhost:8042/apps, but may not be running.

Run:

    node ../../bin/bevy.js start

If you refresh the above, you will see that it is now running.

Access http://127.0.0.1:8042/. You should see the content of index.html.

In a real-world scenario:
* The bevy server would already be running, so that you can skip step 1.
* The commands would be installed, so that you can run "bevy" instead of node ../../bin/bevy.js.
* The ports would be 80 (or 443) instead of 8042.
* Bevy would fetch your 

The difference between this example and a real-world case is just a few configuration options.

