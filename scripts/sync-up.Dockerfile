FROM amazon/aws-cli:2.13.0

# Install MongoDB tools for mongodump
RUN curl -o mongodb-database-tools.rpm https://fastdl.mongodb.org/tools/db/mongodb-database-tools-amazon2-x86_64-100.7.3.rpm && \
    yum install -y mongodb-database-tools.rpm && \
    rm mongodb-database-tools.rpm

WORKDIR /app

COPY sync-up /app/sync-up
RUN chmod +x /app/sync-up

ENTRYPOINT ["/app/sync-up"]
