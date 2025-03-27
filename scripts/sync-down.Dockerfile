FROM amazon/aws-cli:2.13.0

# Install MongoDB tools
RUN curl -o mongodb-database-tools.rpm https://fastdl.mongodb.org/tools/db/mongodb-database-tools-rhel70-x86_64-100.7.0.rpm && \
    yum install -y mongodb-database-tools.rpm && \
    rm mongodb-database-tools.rpm

# Set up working directory
WORKDIR /app

# Copy the sync-down script
COPY sync-down /app/sync-down

# Make the script executable
RUN chmod +x /app/sync-down

# Command to run
ENTRYPOINT ["/app/sync-down"]
