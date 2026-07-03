(async function () {
  // Fetch the user's public IP
  const userIP = await fetch('https://api64.ipify.org?format=json')
    .then((response) => response.json())
    .then((data) => data.ip);

  // Define the list of excluded IPs
  const excludedIPs = ['31.208.244.165']; // Replace with your actual IPs

  // If the user's IP is excluded, skip loading Umami
  if (excludedIPs.includes(userIP)) {
    console.log('Tracking ignored for IP:', userIP);
    return; // Do nothing further
  }

  // If the IP is not excluded, dynamically load the Umami script
  const script = document.createElement('script');
  script.src = 'https://cloud.umami.is/script.js'; // Replace with your Umami instance URL
  script.async = true;
  script.defer = true;
  script.setAttribute('data-website-id', 'da51ba08-993d-4506-bb5c-7ddb5f66e7c6'); // Replace with your website ID
  document.head.appendChild(script);

  console.log('Tracking enabled for IP:', userIP);
})();