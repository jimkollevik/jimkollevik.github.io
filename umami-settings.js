(async function() {
  const userIP = await fetch('https://api64.ipify.org?format=json') // Fetch public IP
    .then(response => response.json())
    .then(data => data.ip);

  const excludedIPs = ['31.208.244.165']; // Add IPs to exclude

  if (excludedIPs.includes(userIP)) {
    umami.ignore = true; // Ignore tracking
  }
})();