import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig = {
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const protectedRoutes = ["/dashboard"];
      const isOnProtectedRoute = protectedRoutes.some((route) =>
        nextUrl.pathname.startsWith(route),
      );
      if (isOnProtectedRoute) {
        if (isLoggedIn) return true;
        return false;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
