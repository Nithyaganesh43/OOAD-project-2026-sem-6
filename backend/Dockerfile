# Use official Node image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy rest of the code
COPY . .

# Expose port (match your server.js port)
EXPOSE 5000

# Start the app
CMD ["npm", "start"]