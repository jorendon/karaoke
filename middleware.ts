import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/jwt";

function isPublicPage(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/s" || pathname.startsWith("/s/")) return true;
  return false;
}

function isPublicApi(pathname: string, method: string): boolean {
  if (pathname === "/api/health") return true;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/logout") {
    return true;
  }
  // Catálogo (usado por invitados en /s/[code])
  if (pathname === "/api/songs/search" && method === "GET") return true;
  // Verificación de video
  if (pathname === "/api/queue/verify" && method === "POST") return true;
  // Agregar a la cola desde la vista pública del invitado: /api/sessions/[code]/queue
  if (
    /^\/api\/sessions\/[^/]+\/queue$/.test(pathname) &&
    (method === "POST" || method === "GET")
  ) {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Ruta raíz: redirige según sesión
  if (pathname === "/") {
    const target = session ? "/dashboard" : "/login";
    return NextResponse.redirect(new URL(target, request.url));
  }

  // Si ya inició sesión e intenta entrar a /login, ir a /dashboard
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Permitir rutas públicas
  if (isPublicPage(pathname) || isPublicApi(pathname, method)) {
    return NextResponse.next();
  }

  // Rutas protegidas: exigir cookie JWT válida
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Rutas exclusivas de administración
  if (
    (pathname === "/admin" ||
      pathname.startsWith("/admin/") ||
      pathname.startsWith("/api/admin/")) &&
    session.role !== "admin"
  ) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Acceso restringido a administradores." },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protege todas las rutas excepto archivos estáticos internos de Next.js
     * y recursos públicos con extensión (favicon, imágenes, etc.).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
