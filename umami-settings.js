(async function () {
  // Wait for Umami to load
  const waitForUmami = () =>
    new Promise((resolve) => {
      const checkUmami = () => {
        if (typeof umami !== 'undefined') {
          resolve(); // Umami is ready
        } else {
          setTimeout(checkUmami, 100); // Check again in 100ms
        }
      };
      checkUmami();
    });

  await waitForUmami(); // Wait for Umami to be defined

  // Fetch the user's IP
  const userIP = await fetch('https://api64.ipify.org?format=json')
    .then((response) => response.json())
    .then((data) => data.ip);

  // Define excluded IPs
  const excludedIPs = ['31.208.244.165'];

  // Exclude tracking if the user's IP matches
  if (excludedIPs.includes(userIP)) {
    umami.ignore = true; // Ignore tracking
    console.log('Tracking ignored for IP:', userIP);
  }
})();