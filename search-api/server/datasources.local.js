module.exports = {
  "db": {
    "name": "db",
    "connector": "memory"
  },
  "DistributedService": {
    "name": "DistributedService",
    "connector": "distributedConnector",
    "urls": (process.env.PROVIDERS || "").split(','),
    "timeout" : (process.env.PROVIDER_TIMEOUT || 1000)
  }
}
