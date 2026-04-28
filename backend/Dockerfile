FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose backend port
EXPOSE 3000

# Start backend server
CMD ["npm", "start"]
