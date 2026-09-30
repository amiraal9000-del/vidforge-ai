import { FalClient } from '@fal-ai/client';

export const fal = new FalClient({
  credentials: process.env.FAL_KEY,
});
