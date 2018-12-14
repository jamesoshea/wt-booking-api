FROM mhart/alpine-node:10
RUN apk update && apk upgrade && apk add --no-cache bash git openssh python make g++

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

ARG WT_CONFIG

RUN npm run createdb

CMD ["npm", "start"]

EXPOSE 8935
