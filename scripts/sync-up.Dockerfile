FROM amazon/aws-cli:2.13.0

# Install MongoDB tools and shell for mongodump and statistics
RUN curl -o mongodb-database-tools.rpm https://fastdl.mongodb.org/tools/db/mongodb-database-tools-amazon2-x86_64-100.7.3.rpm && \
    yum install -y mongodb-database-tools.rpm && \
    rm mongodb-database-tools.rpm && \
    echo "[mongodb-org-5.0]" > /etc/yum.repos.d/mongodb-org-5.0.repo && \
    echo "name=MongoDB Repository" >> /etc/yum.repos.d/mongodb-org-5.0.repo && \
    echo "baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/5.0/x86_64/" >> /etc/yum.repos.d/mongodb-org-5.0.repo && \
    echo "gpgcheck=1" >> /etc/yum.repos.d/mongodb-org-5.0.repo && \
    echo "enabled=1" >> /etc/yum.repos.d/mongodb-org-5.0.repo && \
    echo "gpgkey=https://www.mongodb.org/static/pgp/server-5.0.asc" >> /etc/yum.repos.d/mongodb-org-5.0.repo && \
    yum install -y mongodb-org-shell-5.0.6 && \
    yum clean all

WORKDIR /app

COPY sync-up /app/sync-up
RUN chmod +x /app/sync-up

# Use exec form to properly handle arguments
ENTRYPOINT ["/app/sync-up"]
