import { z } from 'zod';
import { router, publicProcedure } from '../lib/trpc';

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.name}!`,
      };
    }),
  
  getTodos: publicProcedure.query(() => {
    return [
      { id: 1, text: 'Learn tRPC', completed: false },
      { id: 2, text: 'Build awesome app', completed: false },
    ];
  }),
});

export type AppRouter = typeof appRouter;