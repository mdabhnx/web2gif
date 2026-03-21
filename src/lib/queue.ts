// Lightweight queue: API writes PENDING jobs to SQLite,
// the worker process polls and picks them up.
// No Redis or BullMQ needed.

export const QUEUE_NAME = 'gif-generation'
