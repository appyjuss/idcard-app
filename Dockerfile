# Use an official Node.js runtime as a parent image. Use a specific version for reproducibility.
FROM node:18-alpine

# Install postgresql-client so we can use psql in our wait-for-it script
RUN apk add --no-cache postgresql-client fontconfig ttf-dejavu

# Set the working directory in the container to /app
WORKDIR /app

# Copy the package.json and package-lock.json from the server directory
# into the container's /app directory.
COPY server/package*.json ./

# Install app dependencies inside the container
RUN npm install

# Copy wait-for-it.sh into the image and make it executable
COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN chmod +x /usr/local/bin/wait-for-it.sh

# Copy the rest of the server's source code into the container
COPY server/ ./

# Your application binds to port 3001, so we expose it
EXPOSE 3001

# The default command to run when the container starts.
# We will override this in docker-compose for the worker.
CMD ["node", "index.js"]