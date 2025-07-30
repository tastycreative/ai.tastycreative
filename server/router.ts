import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../lib/trpc';

export const appRouter = router({
  // Public procedures
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

  // Protected procedures
  getProfile: protectedProcedure.query(({ ctx }) => {
    return {
      userId: ctx.userId,
      message: 'This is a protected route!',
      timestamp: new Date().toISOString(),
    };
  }),

  getUserTodos: protectedProcedure.query(({ ctx }) => {
    return [
      { id: 1, text: `${ctx.userId}'s personal todo`, completed: false },
      { id: 2, text: 'Secret authenticated task', completed: true },
    ];
  }),

  createTodo: protectedProcedure
    .input(z.object({ text: z.string().min(1) }))
    .mutation(({ input, ctx }) => {
      return {
        id: Math.random(),
        text: input.text,
        userId: ctx.userId,
        completed: false,
        createdAt: new Date().toISOString(),
      };
    }),
});

export type AppRouter = typeof appRouter;