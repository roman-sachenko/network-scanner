const config = Object.freeze({
  scan: {
    portRange: {
      scanPortMin: 1,
      scanPortMax: 65535,
      scanPortToDefault: 1000,
      scanPortFromDefault: 1,
    },
    openPortTimeout: 1000, // ms
  },
})

module.exports = {
  config,
}
