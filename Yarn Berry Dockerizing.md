#nodejs #yarn 
# Yarn DockerFile Example
```dockerfile
FROM node:16-alpine

WORKDIR /usr/src/app

COPY package*.json ./
  
RUN yarn set version berry

RUN yarn install

COPY . .

# RUN npm run build

CMD [ "yarn", "run", "start:dev" ]
```

# Reference
- https://stackoverflow.com/questions/68951890/using-yarn-2-berry-for-packaging-application-in-a-docker-image
- https://stackoverflow.com/questions/47228115/docker-with-yarn