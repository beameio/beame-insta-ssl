# debootstrap stretch stretch
# tar -C stretch -c . | docker import - beame:stretch
FROM beame:stretch

# RUN bash -c "(echo 'deb http://httpredir.debian.org/debian jessie main contrib non-free'; echo 'deb http://security.debian.org/ jessie/updates main contrib non-free'; echo 'deb http://httpredir.debian.org/debian jessie-updates main contrib non-free') >/etc/apt/sources.list"

RUN apt-get -y update && apt-get -y upgrade && apt-get -y install curl git

ADD install/docker-nodejs.sh /nodejs.sh
RUN /nodejs.sh && rm /nodejs.sh

# RUN rm -rf /src/node_modules || true
# RUN npm install

WORKDIR /src
CMD ["/bin/bash"]
