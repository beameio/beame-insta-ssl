# beame-insta-ssl

## What is beame-insta-ssl?

Is a tool that allows to have access to a machine with HTTPS, via a random hostname, without having a public IP address.

When using Beame.io, the private key never leaves your computer/server. Beame does not look into your traffic. While theoretically Beame.io could issue `*.beameio.net` certificate and terminate your traffic (which we don't do), this is preventable by checking certificate fingerprints.

## ... but there is already Ngrok !?

From Ngrok documentation:
> If you want your certificates to match and be protected from man-in-the-middle attacks, you need two things. First, you'll need to buy an SSL (TLS) certificate

You either pay for a certificate or Ngrok terminates SSL for you which is not very secure. With beame-insta-ssl you have free _and_ secure communications.

## Who is it for ?

Web developers, web designers, anyone whose workprouct is displayied in a browser.

## How much does it cost?

The first beame credential, is free and forever will be free.

## How do you guys make money ?

The main purpose here is to show to the world, how beame-sdk can be leveraged to create on demand credentials and tunnels. We think you are going to like this idea, and generate many more beame credentials, for (a) authentication of your backend servers (b) authentication of mobile clients, (c) authentication of users (d) encryption of cloud strage.

## What is the most common and valubale usecase?
I am developing for iOS, and I want to test my web application against my backend code, but it is much more convinient for me test locally, so beame allows me to expose my local development server to the mobile device with SSL terminated at my local workstation.

## What is the difference between terminating and non terminating ?

Ultimatly, non terminating is better, but requires more setup. You need to inject the certificates

## How much data can I transfer?

Right now we are not limiting it, but if there will be unresoable usage.

## Can I loose my beame domain?

Yes, if you use it for phishing we will blacklist it and revoke your cert.

# How do you do you begin using the beame-insta-ssl?

	sudo npm install -g https://github.com/beameio/beame-insta-ssl.git

then please go visit https://p2payp4q8f5ruo22.q6ujqecc83gg6fod.v1.d.beameio.net

You will receive an email message with a special command. Please run the command, and beame-insta-ssl will obtain your very own beame hostname, and issue a valid public certificate for it.

Once the certificate is ready you can start using your tunnel. Sample command for bringing up a tunnel:

	beame-insta-ssl tunnel 8008 http

Use the command above if you dont want to install certificates into your own server.

	beame-insta-ssl tunnel 8008 http --hostname www.mysite.com

This is an old world example, of running a virutal host on HTTP.

To easily export credentials from the `~/.beame` folder use the `export` command that looks like the following:

	beame-insta-ssl export k6pbq8cp5tnthu5d.v1.d.beameio.net ./k6pbq8cp5tnthu5d.v1.d.beameio.net
