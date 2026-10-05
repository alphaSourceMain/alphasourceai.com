// Deployment containment only. SalesApp's verified account gate still controls access.
export function salesRaceAvailable(hostname, dev = false) {
  return dev === true || hostname === 'alphasourceai-com.onrender.com';
}
