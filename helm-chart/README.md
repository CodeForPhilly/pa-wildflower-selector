# Helm chart

This directory contains a Helm chart for deploying the app to a Kubernetes cluster.

## Requirements

- Install the `helm` 3 CLI client

## Testing

From the project's root directory, you can render the helm template locally without connecting to any Kubernetes cluster

```bash
helm template cnp-production ./helm-chart | code -
```

With a local Kubernetes cluster set up, you can install the chart:

```bash
helm upgrade cnp-prod ./helm-chart \
    --install \
    --namespace choose-native-plants \
    --create-namespace
```
