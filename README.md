<img align="right" src="img/beame.png">
# beame-insta-ssl

## What is beame-insta-ssl?

This is a free, open-source tool that allows you to expose securely a machine with HTTP or HTTPS server via a random hostname without needing to have a public IP address.

When using Beame.io, the private key never leaves your computer/server. Beame cannot look into your traffic. While, theoretically, Beame.io could issue a wildcard `*.beameio.net` certificate and terminate your traffic (which we don't do), this is preventable by checking certificate fingerprints.

## Get started in three quick steps!

Step 1: Sign up super-fast [here!](https://ypxf72akb6onjvrq.ohkv8odznwh5jpwm.v1.p.beameio.net/insta-ssl)

(if you use Windows, see [Windows System Requirements](#Windows System Requirements) below before Step 2)

Step 2 for Mac/Linux: Run `sudo npm install -g beame-insta-ssl` (**please make sure you are using NodeJS version 6.9.X**). Depending on your configuration you might want to run `npm install -g beame-insta-ssl` instead (if you are using [`n`](https://github.com/tj/n) or other methods for creating per-user NodejS installations).

Step 2 for Windows: Run `npm install -g beame-insta-ssl` (**please make sure you are using NodeJS version 6.9.X**).

Step 3: Run the command in the sign up confirmation email you just got from us. beame-insta-ssl will obtain your very own beame hostname, and issue a valid public certificate for it.

The certificate will be ready in moments and you can start using your tunnel right away. Truly a one-stop-shop!

### Windows System Requirements <a name="Windows System Requirements"></a>

Before running `npm install -g beame-insta-ssl` please make sure you have OpenSSL installed in `C:\OpenSSL-Win64` . If you you already have OpenSSL installed at that location, skip the instructions below and just issue `npm install -g beame-insta-ssl`. If you don't have OpenSSL in `C:\OpenSSL-Win64`, one of the possible ways of installing OpenSSL is described below (Install Visual C++ Build Tools and Python 2.7, Upgrade NPM, Install Perl, Install OpenSSL). The procedure was tested on Microsoft Windows Server 2012 R2 Standard and Windows 10. We recommend to use your “Windows PowerShell” and run it with administrator rights for the following commands:

### Install Visual C++ Build Tools and Python 2.7

`npm install --global --production windows-build-tools`. This typically takes 5 to 10 minutes, depending on the internet connection.

### Upgrade NPM

`npm -g install npm@latest`

### Install Perl

Perl is needed for building OpenSSL. If you already have Perl installed, please skip the `Install Perl` section.

Get Perl from
`https://downloads.activestate.com/ActivePerl/releases/5.24.0.2400/ActivePerl-5.24.0.2400-MSWin32-x64-300558.exe` (SHA256 is `9e6ab2bb1335372cab06ef311cbaa18fe97c96f9dd3d5c8413bc864446489b92`)
or another source.
 This version of Perl [might have](https://community.activestate.com/node/19784) [security](https://www.virustotal.com/en/file/9e6ab2bb1335372cab06ef311cbaa18fe97c96f9dd3d5c8413bc864446489b92/analysis/) [issue](https://www.metadefender.com/#!/results/file/c869301df9424b02aa49ce15d7bce692/regular/analysis) but my estimation is that it's false positive. Consider installing other versions or Perl built by other companies.

### Install OpenSSL

Download and extract `https://www.openssl.org/source/openssl-1.0.1t.tar.gz` (other versions might work but were not tested)

Using "Visual C++ 2015 x64 Native Build Tools Command Prompt" under `C:\Program Files (x86)\Microsoft Visual C++ Build Tools\` in the OpenSSL directory issue the following commands:

    perl Configure VC-WIN64A no-asm --prefix=C:\OpenSSL-Win64
    .\ms\do_win64a.bat
	# If the following "clean" fails it's OK, just continue with following commands
    nmake -f ms\ntdll.mak clean
    nmake -f ms\ntdll.mak
    nmake -f ms\ntdll.mak install

    npm install -g beame-insta-ssl

<img src="img/video.gif">

**Check out our Wiki with how to guides:**

1. [Beginner's Guide to beame-insta-ssl with Screenshots](https://github.com/beameio/beame-insta-ssl/wiki/Beginner%E2%80%99s-Guide-to-Using-beame-insta-ssl)
2. [Installing a Non-Terminating Tunnel to IIS on Windows](https://github.com/beameio/beame-insta-ssl/wiki/How-to-Install-a-Non-Terminating-Tunnel-to-IIS)

How To Guides Coming soon:

3. Tunneling to Apache with beame-insta-ssl (Mac, Windows, Linux)
4. Tunneling to NGNIX with beame-insta-ssl (Mac, Windows, Linux)

## ... but this is already done by ngrok, Let's Encrypt, and ___your service here___!?

Yes, but you have to either: pay for the SSL certificate, pay for premium tunneling services, get your TLS terminated for you (which is...not very secure), and/or reconfigure your DNS if you are using free certs. 

With beame-insta-ssl, you get both free _and_ secure communications. Did we mention, it's ridiculously easy to use? :-)

## Who is beame-insta-ssl for?

Web developers, web designers, anyone whose work product is displayed in a browser. 

## How much does it cost?

Your first beame credential is free and will remain free forever.

## How do you guys make money?

This is a service that allows making encryption accessible to all and widely used, even by non-crypto experts. If you need more, or want to use this for enterprise, the **[beame-sdk](https://github.com/beameio/beame-sdk)** is the next level. It can be leveraged to create on-demand credentials and tunnels, and build private networks with cryptography based trust. We think you are going to like this idea and will generate many more beame credentials, for (a) authentication of your backend servers, (b) authentication of mobile clients, (c) authentication of users, and (d) encryption of cloud storage.

## What is the most common and valuable use case?
I am developing for iOS, and I want to test my web application against my backend code, but it is much more convenient for me to test locally. Beame allows me to expose my local development server to the mobile device with TLS terminated at my local workstation.

## What is the difference between terminating and non-terminating?

Ultimately, non-terminating is better but requires more setup. You need to inject the certificates.

## How much data can I transfer?

Right now we are not limiting it, but might if we get unreasonable usage.

## Can I lose my beame domain?

Yes. If you use it for phishing we will blacklist it and revoke corresponding cert.

# Commands for using beame-insta-ssl:

Step 1: [Sign up here, humans only,](https://ypxf72akb6onjvrq.ohkv8odznwh5jpwm.v1.p.beameio.net/insta-ssl) and receive your personal token by email (make sure you use an email you can access). 

Step 2: Install beame-insta-ssl by running	`npm install -g beame-insta-ssl`

Step 3: Run the command in your registration confirmation email. beame-insta-ssl will obtain your very own beame hostname, and issue a valid public certificate for it.

The certificate will be ready in moments and you can start using your tunnel right away. 

Sample command for bringing up a tunnel:

	beame-insta-ssl tunnel 8008 http

Use the command above if you want to have a secure connection, but don't want to install certificates into your own server. You will receive the following output:

	Starting tunnel https://qwertyuio.asdfghjkl.v1.d.beameio.net -> http://localhost:8008

Just run your server on desired port (_8008_ in the above example) and point any web browser to your random Beame hostname (_https://qwertyuio.asdfghjkl.v1.d.beameio.net_ in sample output above)

You can also specify particular Beame hostname to run a tunnel to, in case, for example, when you have more than one set of Beame credentials:

	beame-insta-ssl tunnel 8008 http --fqdn qwertyuio.asdfghjkl.v1.d.beameio.net

## Where is my Beame data stored?
Credentials created by you are stored on your machine in `$HOME/.beame` folder. You can easily export them to the desired location, by using the `export` command that looks like this:

	beame-insta-ssl export qwertyuio.asdfghjkl.v1.d.beameio.net ./destination_folder_path

