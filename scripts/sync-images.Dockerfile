FROM amazon/aws-cli:2.13.0

# Set up working directory
WORKDIR /app

# Copy the sync-images script
COPY sync-images /app/sync-images

# Make the script executable
RUN chmod +x /app/sync-images

# Command to run
ENTRYPOINT ["/app/sync-images"]
