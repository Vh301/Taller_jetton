import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/webhook") {
    return NextResponse.rewrite(new URL("/api/telegram/poster", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/webhook",
};
