<img align="right" src="img/beame.png">
# beame-insta-ssl

## What is beame-insta-ssl?

This is a tool that allows you to have access to a machine with HTTPS via a random hostname without needing to have a public IP address.

When using Beame.io, the private key never leaves your computer/server. Beame cannot look into your traffic. While, theoretically, Beame.io could issue a wildcard `*.beameio.net` certificate and terminate your traffic (which we don't do), this is preventable by checking certificate fingerprints.

## ... but there is already Ngrok!?

From Ngrok documentation:
> If you want your certificates to match and be protected from man-in-the-middle attacks, you need two things. First, you'll need to buy an SSL (TLS) certificate

You either pay for a certificate or Ngrok terminates SSL for you, which is not very secure, and you need to be using a premium package with ngrok. With beame-insta-ssl, you get both free _and_ secure communications.

## Who is beame-insta-ssl for?

Web developers, web designers, anyone whose work product is displayed in a browser.

## How much does it cost?

Your first beame credential is free and will remain free forever.

## How do you guys make money?

The main purpose here is to show to the world how the beame-sdk can be leveraged to create on-demand credentials and tunnels. We think you are going to like this idea and will generate many more beame credentials, for (a) authentication of your backend servers, (b) authentication of mobile clients, (c) authentication of users, and (d) encryption of cloud storage.

## What is the most common and valuable use case?
I am developing for iOS, and I want to test my web application against my backend code, but it is much more convenient for me to test locally. Beame allows me to expose my local development server to the mobile device with SSL terminated at my local workstation.

## What is the difference between terminating and non-terminating?

Ultimately, non-terminating is better but requires more setup. You need to inject the certificates.

## How much data can I transfer?

Right now we are not limiting it, but might if we get unreasonable usage.

## Can I lose my beame domain?

Yes. If you use it for phishing we will blacklist it and revoke your cert.

# How do I begin using the beame-insta-ssl?

	sudo npm install -g https://github.com/beameio/beame-insta-ssl.git

then please go visit https://ypxf72akb6onjvrq.ohkv8odznwh5jpwm.v1.p.beameio.net/insta-ssl

You will receive an email message with a special command. Please run the command, and beame-insta-ssl will obtain your very own beame hostname, and issue a valid public certificate for it.

Once the certificate is ready, you can start using your tunnel. Sample command for bringing up a tunnel:

	beame-insta-ssl tunnel 8008 http

Use the command above if you want to have a secure connection, but don't want to install certificates into your own server. You will receive the following output:

	Starting tunnel https://qwertyuio.asdfghjkl.v1.d.beameio.net -> http://localhost:8008

Just run your server on desired port (_8008_ in the above example) and point any web browser to your random Beame hostname (_https://qwertyuio.asdfghjkl.v1.d.beameio.net_ in sample output above)

You can also specify particular Beame hostname to run a tunnel to, in case, for example, when you have more than one set of Beame credentials:

	beame-insta-ssl tunnel 8008 http --fqdn qwertyuio.asdfghjkl.v1.d.beameio.net

## Where is my Beame data is stored?
Credentials created by you are stored on your machine in `$HOME/.beame` folder. You can easily export them to the desired location, by using the `export` command that looks like this:

	beame-insta-ssl export qwertyuio.asdfghjkl.v1.d.beameio.net ./destination_folder_path

