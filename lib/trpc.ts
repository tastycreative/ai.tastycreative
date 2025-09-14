import { initTRPC, TRPCError } from '@trpc/server';
import { auth } from '@clerk/nextjs/server';

interface Context {
  userId?: string | null;
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId as string,
    },
  });
});

export const createContext = async (opts: { req: Request }) => {
  // Get the current user from Clerk
  const { userId } = await auth();
  
  return {
    userId,
  } as Context;
};