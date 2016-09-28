What is beame-insta-sll?
Is a tool that allows to have access to a machine with HTTPS, via a random hostname, without having a public IP address.

Who is it for ?
Web developers, web designers, anyone whose workprouct is displayied in a browser.

How much does it cost?
The first beame credential, is free and forever will be free.  

How do you guys make money ?
The main purpose here is to show to the world, how beame-sdk can be levelraged to create on demand credentials and tunnels. We think you are going to like this idea, and generate many more beame credentials, for (a) authentication of your backend servers (b) authentication of mobile clients, (c) authentication of users (d) encryption of cloud strage. 

What is the most common and valubale usecase?
I am developing for Ios, and I want to test my web application against my backend code, but it is much more convinient for me test locally, so beame allows me to expose my local development server to the mobile device with SSL terminated at my local workstation.


What is the difference between terminating and non terminating ?
Ultimatly, non terminating is better, but requires more setup. You need to inject the certs 

How much data can I transfer:
Right now we are not limiting it, but if there will be unresoable usage. 

Can i loose my beame domain:
Yes, if you use it for phishing we will blacklist it and revoke your cert. 

How do you do you begin using the InstaSSL:

sudo npm install https://github.com/beameio/beame-insta-ssl.git
then please go with your web browser you: https://p2payp4q8f5ruo22.q6ujqecc83gg6fod.v1.d.beameio.net
You will revive an email message with a special command, execute the command, and it will obtain your very own beame hostname, and issue a valid public cert for it.

Once its all done, you can create you tunnels some examples:

beame-insta-ssl tunnel 8008 http
Use this if you dont want to install certs into your own server. 


beame-insta-ssl tunnel 8008 http --hostname www.mysite.com 
This is an old world example, of running a virutal host on HTTP.

To easily export credentials from the .beame folder use the export command 

beame-insta-ssl export --fqdn k6pbq8cp5tnthu5d.v1.d.beameio.net --destination_folder './k6pbq8cp5tnthu5d.v1.d.beameio.net'

