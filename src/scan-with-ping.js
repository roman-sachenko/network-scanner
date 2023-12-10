const { exec } = require('node:child_process')
const os = require('node:os')
const dns = require('node:dns')
const net = require('node:net')
const { config } = require('./config')

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
  return results.filter((result) => result.alive).map((result) => result.ip)
}

const getHostNamesForIp = async (ip) => {
  try {
    const hostnames = await new Promise((resolve) => {
      dns.reverse(ip, (err, hostnames) => {
        if (err) {
          resolve([])
        }
        resolve(hostnames)
      })
    })
    return {
      [ip]: hostnames,
    }
  } catch (error) {
    return {
      [ip]: [],
    }
  }
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

const isPortOpen = async (ip, port) => {
  try {
    const isOpen = await new Promise((resolve) => {
      const socket = new net.Socket()
      const onError = () => {
        socket.destroy()
        resolve(false)
      }
      const onTimeout = () => {
        socket.destroy()
        resolve(false)
      }
      socket.setTimeout(config.scan.openPortTimeout)
      socket.on('error', onError)
      socket.on('timeout', onTimeout)
      socket.connect(port, ip, () => {
        socket.end()
        resolve(true)
      })
    })
    return {
      ip,
      port,
      isOpen,
    }
  } catch (error) {
    return {
      ip,
      port,
      isOpen: false,
    }
  }
}

const getOpenPortsForIp = async (ip, portFrom, portTo) => {
  const batchSize = 3000
  const openPorts = []

  for (let port = portFrom; port <= portTo; port += batchSize) {
    const endPort = Math.min(port + batchSize, portTo)
    const batch = Array.from(
      { length: endPort - port + 1 },
      (_, k) => k + port + 1
    )
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

const getOpenPortsForIps = async (ips, portFrom, portTo) => {
  const openPortsByIp = {}
  for await (const ip of ips) {
    const openPorts = await getOpenPortsForIp(ip, portTo, portFrom)
    openPortsByIp[ip] = openPorts
  }
  return openPortsByIp
}

const logScanReport = (scanReport) => {
  console.info('\nScan report:')
  console.table(scanReport)
}

const getPortsRange = () => {
  const SCAN_PORT_MIN = config.scan.portRange.scanPortMin
  const SCAN_PORT_MAX = config.scan.portRange.scanPortMax
  const SCAN_PORT_TO_DEFAULT = config.scan.portRange.scanPortToDefault
  const SCAN_PORT_FROM_DEFAULT = config.scan.portRange.scanPortFromDefault

  let [, , port1, port2] = process.argv

  const parsePort = (port, defaultPort) => {
    const parsedPort = parseInt(port, 10)
    return parsedPort >= SCAN_PORT_MIN && parsedPort <= SCAN_PORT_MAX
      ? parsedPort
      : defaultPort
  }

  port1 = parsePort(port1, SCAN_PORT_FROM_DEFAULT)
  port2 = parsePort(port2, SCAN_PORT_TO_DEFAULT)

  return {
    portFrom: Math.min(port1, port2),
    portTo: Math.max(port1, port2),
  }
}

const scan = async (portFrom, portTo) => {
  console.info('Scanning network...', { portFrom, portTo })

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

  console.info('Scanning active ports...(May take a few minutes)')
  const ipsToOpenPorts = await getOpenPortsForIps(activeIps, portTo, portFrom)
  console.info('Scanning active ports. OK.')

  const scanReport = activeIps.map((ip) => ({
    ip,
    hostnames: ipsToHostNames[ip],
    ports: ipsToOpenPorts[ip].join(', ') || 'none',
  }))
  console.info('Scanning network. OK.')
  return scanReport
}

const main = async () => {
  const TIMER_NAME_NETWORK_SCAN = '[TIME_NETWORK_SCAN]'

  const { portFrom, portTo } = getPortsRange()

  console.time(TIMER_NAME_NETWORK_SCAN)

  const scanReport = await scan(portFrom, portTo)

  console.info('\n')
  console.timeEnd(TIMER_NAME_NETWORK_SCAN)

  logScanReport(scanReport)
}

main()
