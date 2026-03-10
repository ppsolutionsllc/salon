import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
    interface User {
        id: string
        email: string
        global_role?: string
        accessToken?: string
        refreshToken?: string
    }

    interface Session {
        user: {
            id: string
            email: string
            global_role?: string
        }
        accessToken?: string
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        id?: string
        global_role?: string
        accessToken?: string
        refreshToken?: string
    }
}
