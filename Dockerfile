FROM mhart/alpine-node:10
RUN apk update && apk upgrade && apk add --no-cache bash git openssh python make g++

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

CMD ["npm", "start"]

EXPOSE 8935
