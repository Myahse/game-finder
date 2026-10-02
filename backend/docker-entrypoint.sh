#!/bin/sh
set -e
mkdir -p /data/uploads
chown -R nonroot:nonroot /data/uploads
exec su-exec nonroot /api
