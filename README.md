# Network Scanner (NodeJS)

## Overview

This Simple Network Scanner is an ongoing project designed to help users scan their local network. It is capable of identifying active IP addresses, open ports, and hostnames within a specified IP range. This tool is particularly useful for network administrators or anyone interested in understanding the landscape of their network environment.

> Yep, using tools like ARP or NMAP is faster and better (this is an educational project).

As an ongoing project, new functionalities will be added as inspiration strikes.

## Features

- **Network Information Retrieval**: Gathers basic network information like the system's IP address and subnet.
- **Ping Utility**: Checks the availability of IP addresses within the subnet.
- **Active IP Scanning**: Identifies active IP addresses within a specified range.
- **Port Scanning**: Detects open ports on active IP addresses.
- **Hostname Resolution**: Resolves hostnames for each active IP address.

## How It Works

1. **Network Information**: First, the scanner retrieves the network information of the system it is running on, identifying the subnet to scan.
2. **Active IP Scanning**: The scanner then pings IP addresses within the subnet to find active ones.
3. **Open Port Scanning**: For each active IP address, the scanner checks for open ports within a specified range.
4. **Hostname Resolution**: The scanner resolves and lists hostnames associated with each active IP.


## Installation

Clone the repository and install the necessary dependencies:

```bash
git clone git@github.com:roman-sachenko/network-scanner.git

cd network-scanner

pnpm install
```

## Usage

To use the network scanner, simply run the main script. You can optionally specify a range of ports to scan:

```bash
node src/scan-with-ping.js [startPort] [endPort]
```

or

```bash
pnpm scan:ping [startPort] [endPort]
```

If no port range is specified, the scanner uses default values.


## Contributions

Contributions are welcome! If you have ideas for new features or improvements, feel free to fork the repository and submit a pull request.

## License

This project is MIT licensed. See the LICENSE file for more details.