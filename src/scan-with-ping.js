const { exec } = require('node:child_process')
const os = require('node:os')
const dns = require('node:dns')
const net = require('node:net')

const getNetworkInfo = () => {
  const networkInterfaces = os.networkInterfaces()
  for (const networkInterface of Object.values(networkInterfaces)) {
    for (const network of networkInterface) {
      if (network.family === 'IPv4' && !network.internal) {
        return {
          myAddress: network.address,
          subnets: [network.address.split('.').slice(0, 3).join('.')],
        }
      }
    }
  }
}
const ping = async (ip) => {
  return new Promise((resolve, reject) => {
    if (!ip.length) {
      return reject(new Error('IP is required'))
    }
    exec(`ping -c 1 -t 1 ${ip}`, (err, stdout, stderr) => {
      if (err || stderr) {
        return resolve({
          ip,
          alive: false,
        })
      }
      return resolve({
        ip,
        alive: true,
      })
    })
  })
}

const getNetworkIpsByBase = (base) => {
  const ips = []
  for (let i = 1; i < 255; i++) {
    ips.push(`${base}.${i}`)
  }
  return ips
}

const getActiveIps = async (base) => {
  const ips = getNetworkIpsByBase(base)
  const promises = ips.map((ip) => ping(ip))
  const results = await Promise.all(promises)
  const activeIps = []

  for (let i = 0; i < results.length; i++) {
    if (results[i].alive) {
      activeIps.push(results[i].ip)
    }
  }

  return activeIps
}

const getHostNamesForIp = (ip) => {
  return new Promise((resolve) => {
    dns.reverse(ip, (err, hostnames) => {
      if (err) {
        return resolve({
          [ip]: [],
        })
      }
      return resolve({
        [ip]: hostnames,
      })
    })
  })
}

const getHostNamesForIps = async (ips = []) => {
  const output = await Promise.all(ips.map((ip) => getHostNamesForIp(ip)))
  return output.reduce((acc, curr) => {
    return {
      ...acc,
      ...curr,
    }
  }, {})
}

const isPortOpen = (ip, port) => {
  return new Promise((resolve) => {
    const socket = new net.Socket()

    const onError = () => {
      socket.destroy()
      return resolve({
        ip,
        port,
        isOpen: false,
      })
    }

    const onTimeout = () => {
      socket.destroy()
      return resolve({
        ip,
        port,
        isOpen: false,
      })
    }

    socket.setTimeout(1000)
    socket.on('error', onError)
    socket.on('timeout', onTimeout)

    socket.connect(port, ip, () => {
      socket.end()
      return resolve({
        ip,
        port,
        isOpen: true,
      })
    })
  })
}

const getOpenPortsForIp = async (ip, portMax = 65535, portMin = 1) => {
  const maxPort = portMax
  const minPort = portMin
  const batchSize = 3000
  const openPorts = []

  for (let port = minPort; port <= maxPort; port += batchSize) {
    const endPort = Math.min(port + batchSize, maxPort)
    const batch = Array.from({ length: endPort - port }, (_, k) => k + port + 1)

    const promises = batch.map((port) => isPortOpen(ip, port))
    const results = await Promise.all(promises)

    for (const result of results) {
      if (result.isOpen) {
        openPorts.push(result.port)
      }
    }
  }

  return openPorts
}

const getOpenPortsForIps = async (ips, portMax = 65535, portMin = 1) => {
  const openPortsByIp = {}
  for await (const ip of ips) {
    const openPorts = await getOpenPortsForIp(ip, portMax, portMin)
    openPortsByIp[ip] = openPorts
  }

  return openPortsByIp
}

const logScanReport = (scanReport) => {
  console.info('Scan report:')
  console.table(scanReport)
}

const main = async () => {
  const SCAN_PORT_MIN = 1
  const SCAN_PORT_MAX = 1000

  console.info('Scanning network...', { SCAN_PORT_MIN, SCAN_PORT_MAX })

  console.info('Getting network info...')
  const { subnets } = getNetworkInfo()
  console.info('Getting network info. OK.')
  const currentSubnet = subnets[0]

  console.info(`Scanning active IPs in subnet "${currentSubnet}"...`)
  const activeIps = await getActiveIps(currentSubnet)
  console.info('Scanning active IPs. OK.', { count: activeIps.length })

  console.info('Scanning hostnames for active IPs...')
  const ipsToHostNames = await getHostNamesForIps(activeIps)
  console.info('Scanning hostnames for active IPs. OK.')

  console.info('Scanning active ports...')
  const ipsToOpenPorts = await getOpenPortsForIps(
    activeIps,
    SCAN_PORT_MAX,
    SCAN_PORT_MIN
  )
  console.info('Scanning active ports. OK.')

  const scanReport = []

  for (const ip of activeIps) {
    const hostNames = ipsToHostNames[ip]
    const openPorts = ipsToOpenPorts[ip]
    scanReport.push({
      ip,
      hostnames: hostNames,
      ports: openPorts,
    })
  }

  console.info('Scanning network. OK.')
  logScanReport(scanReport)
}

main()
