// Simple distance calculation using Haversine formula
// This calculates distance between two coordinates in kilometers

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

// Calculate delivery charge based on distance
// ≤ 10 km → €2
// > 10 km → €3
// Pickup → free (handled in routes)
function calculateDeliveryCharge(distance) {
  if (distance <= 0) return 0;
  
  if (distance <= 10) {
    return 2.00; // €2 for distances up to 10 km
  } else {
    return 3.00; // €3 for distances over 10 km
  }
}

// Geocode address to coordinates
// For production: Use Google Maps Geocoding API or OpenRouteService
// 
// Example with Google Maps API:
// const axios = require('axios');
// async function geocodeAddress(address) {
//   const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
//   const response = await axios.get(
//     `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
//   );
//   if (response.data.results && response.data.results.length > 0) {
//     const location = response.data.results[0].geometry.location;
//     return { lat: location.lat, lng: location.lng };
//   }
//   throw new Error('Address not found');
// }
//
// Example with OpenRouteService (free alternative):
// async function geocodeAddress(address) {
//   const API_KEY = process.env.OPENROUTESERVICE_API_KEY;
//   const response = await axios.get(
//     `https://api.openrouteservice.org/geocoding/search?api_key=${API_KEY}&text=${encodeURIComponent(address)}`
//   );
//   if (response.data.features && response.data.features.length > 0) {
//     const coords = response.data.features[0].geometry.coordinates;
//     return { lat: coords[1], lng: coords[0] }; // Note: OpenRouteService returns [lng, lat]
//   }
//   throw new Error('Address not found');
// }

async function geocodeAddress(address) {
  // DEMO MODE: For production, replace this with actual geocoding API
  // Default restaurant location: Bahnhof str.119, 47137 Duisburg
  const restaurantLocation = {
    lat: 51.4322,
    lng: 6.7611,
  };
  
  // For demo, simulate different distances based on address
  // This creates a pseudo-random distance between 2-15 km for testing
  const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const distanceKm = 2 + (hash % 130) / 10; // Distance between 2-15 km
  const offset = distanceKm / 111; // Approximate km to degrees (1 degree ≈ 111 km)
  
  return {
    lat: restaurantLocation.lat + offset,
    lng: restaurantLocation.lng + offset,
  };
}

module.exports = {
  calculateDistance,
  calculateDeliveryCharge,
  geocodeAddress,
};

