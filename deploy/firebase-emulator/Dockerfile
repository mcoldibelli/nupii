# Firebase Authentication emulator for the local environment and the CI.
# It keeps the accounts in memory: they are lost when the container restarts.
FROM node:24-slim

RUN npm install -g firebase-tools@15.35.0 && npm cache clean --force

WORKDIR /emulator
COPY firebase.json .
EXPOSE 9099

# A project name that starts with "demo-" never reaches a real project.
CMD ["firebase", "emulators:start", "--only", "auth", "--project", "demo-nupii"]
