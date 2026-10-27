// Advertising-v1 writes/replays are intentionally retired in V10.
// Keep the historical test command as a compatibility entry point; the current
// harness explicitly proves old advertising rows are preserved, all old POSTs
// are rejected, and record-storage requests never create advertising consent.
await import('./test-reading-records-backend.mjs');
