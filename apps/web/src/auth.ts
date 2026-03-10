import NextAuth, { NextAuthConfig, DefaultSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

declare module "next-auth" {
    interface Session {
        accessToken?: string
        error?: string
        user: {
            id: string
            global_role: string
        } & DefaultSession["user"]
    }
}

export const authConfig = {
    trustHost: true,
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email / Phone / Login", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null

                try {
                    const apiBase = (process.env.API_INTERNAL_URL || process.env.INTERNAL_API_URL || "http://api:8000").replace(/\/+$/, "");
                    const apiUrl = `${apiBase}/api/v1`;
                    const res = await fetch(`${apiUrl}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            username: credentials.email as string,
                            password: credentials.password as string,
                        })
                    })

                    if (!res.ok) return null

                    const tokens = await res.json()

                    // Next fetch me to get user details
                    const meRes = await fetch(`${apiUrl}/auth/me`, {
                        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
                    })

                    if (!meRes.ok) return null

                    const user = await meRes.json()

                    return {
                        id: user.id.toString(),
                        email: user.email,
                        global_role: user.global_role,
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token
                    }
                } catch (e) {
                    console.error("Auth error", e)
                    return null
                }
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            // Initial sign in
            if (user) {
                token.accessToken = user.accessToken
                token.refreshToken = user.refreshToken
                token.global_role = user.global_role
                token.id = user.id
                token.accessTokenExpires = Date.now() + 29 * 60 * 1000; // 29 min
                return token
            }

            // Return previous token if the access token has not expired yet
            if (Date.now() < (token.accessTokenExpires as number)) {
                return token;
            }

            // Access token has expired, try to update it
            try {
                const apiBase = (process.env.API_INTERNAL_URL || process.env.INTERNAL_API_URL || "http://api:8000").replace(/\/+$/, "");
                const apiUrl = `${apiBase}/api/v1`;
                const response = await fetch(`${apiUrl}/auth/refresh?refresh_token=${token.refreshToken}`, {
                    method: 'POST',
                });

                if (!response.ok) throw new Error("Refresh failed");

                const refreshedTokens = await response.json();

                return {
                    ...token,
                    accessToken: refreshedTokens.access_token,
                    refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
                    accessTokenExpires: Date.now() + 29 * 60 * 1000,
                };
            } catch (error) {
                console.error("Error refreshing access token", error);
                return { ...token, error: "RefreshAccessTokenError" };
            }
        },
        async session({ session, token }) {
            session.user.id = token.id as string
            session.user.global_role = token.global_role as string
            session.accessToken = token.accessToken as string
            session.error = token.error as string | undefined
            return session
        }
    },
    pages: {
        signIn: '/login',
    },
    session: { strategy: "jwt" }
} satisfies NextAuthConfig

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
