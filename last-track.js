
    // URL to Json file in repo
    const apiUrl = "https://www.jimkollevik.com/recent-tracks.json";

    async function fetchRecentTracks() {
      const tracksDiv = document.getElementById("tracks");
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`HTTP-error! Status: ${response.status}`);
        }
        const data = await response.json();

        // Empty and only show last played track
        tracksDiv.innerHTML = "";

        // Get first song only (index 0)
        const track = data.recenttracks.track[0];
        if (track) {
          const trackName = track.name;
          const artistName = track.artist["#text"];
          const trackUrl = track.url; // URL to track LastFM

          // Create HTML link with URL
          const trackDiv = document.createElement("div");
          trackDiv.className = "track";
          trackDiv.innerHTML = `
            Last played track: 
            <a href="${trackUrl}" target="_blank" rel="noopener noreferrer">
              ${trackName} by ${artistName} &#8599;&#xFE0E;
            </a>
          `;
          tracksDiv.appendChild(trackDiv);
        } else {
          tracksDiv.innerHTML = "No tracks found";
        }
      } catch (error) {
        console.error("Error getting tracks:", error);
        tracksDiv.innerHTML = "Could not retreive tracks.";
      }
    }

    // Kör funktionen när sidan laddas
    fetchRecentTracks();