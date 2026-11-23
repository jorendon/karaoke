import "dotenv/config";
import dotenv from "dotenv";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

// Carga .env.local automáticamente si existe
dotenv.config({ path: ".env.local", override: true });

const USERNAME_REGEX = /^[a-z0-9][a-z0-9._-]{2,31}$/;

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sqlOnly = Boolean(args["sql-only"]);

  let username =
    typeof args.username === "string" ? args.username.trim().toLowerCase() : "";
  let password = typeof args.password === "string" ? args.password : "";
  let displayName =
    typeof args.name === "string" ? args.name.trim() : "";
  let role =
    typeof args.role === "string" ? args.role.trim().toLowerCase() : "";

  if (!username || !password || !role) {
    const rl = readline.createInterface({ input, output });
    try {
      if (!username) {
        username = (await rl.question("Usuario (minúsculas, 3-32 chars): "))
          .trim()
          .toLowerCase();
      }
      if (!displayName) {
        displayName = (
          await rl.question("Nombre visible (opcional, Enter para omitir): ")
        ).trim();
      }
      if (!role) {
        const answer = (
          await rl.question("Rol [admin/host] (por defecto admin): ")
        )
          .trim()
          .toLowerCase();
        role = answer === "host" ? "host" : "admin";
      }
      if (!password) {
        password = await rl.question("Contraseña (mínimo 8 caracteres): ");
      }
    } finally {
      rl.close();
    }
  }

  if (!USERNAME_REGEX.test(username)) {
    console.error(
      "Error: el usuario debe tener entre 3 y 32 caracteres (minúsculas, números, '.', '_' o '-')."
    );
    process.exit(1);
  }

  if (role !== "admin" && role !== "host") {
    console.error("Error: el rol debe ser 'admin' o 'host'.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Error: la contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  if (sqlOnly) {
    const escapedDisplay = displayName
      ? `'${displayName.replace(/'/g, "''")}'`
      : "null";
    console.log("\n-- Ejecuta esto en Supabase -> SQL Editor:\n");
    console.log(
      `insert into public.app_users (username, password_hash, display_name, role, is_active)\n` +
        `values ('${username}', '${passwordHash}', ${escapedDisplay}, '${role}', true);\n`
    );
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Error: faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local.\n" +
        "Sugerencia: también puedes ejecutar este script con --sql-only para obtener el INSERT SQL listo para pegar en Supabase."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("app_users")
    .insert({
      username,
      password_hash: passwordHash,
      display_name: displayName || null,
      role,
      is_active: true,
    })
    .select("id, username, display_name, role, is_active, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      console.error(`Error: ya existe el usuario '${username}'.`);
    } else {
      console.error("Error al crear usuario:", error.message);
    }
    process.exit(1);
  }

  console.log("Usuario creado correctamente:");
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error("Error inesperado:", err instanceof Error ? err.message : err);
  process.exit(1);
});
