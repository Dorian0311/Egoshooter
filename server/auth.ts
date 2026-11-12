import { jwtVerify } from "jose";
export async function identity(
  ticket: unknown,
): Promise<{ id: string; name: string }> {
  if (typeof ticket !== "string" || ticket.length > 4096)
    throw Error("Zugangsticket erforderlich");
  const key = process.env.SHOOTER_TICKET_SECRET;
  if (!key || key.length < 32)
    throw Error("Spielzugang ist nicht konfiguriert");
  const { payload } = await jwtVerify(ticket, new TextEncoder().encode(key), {
    issuer: "supporthub",
    audience: "altstadt-1940",
    algorithms: ["HS256"],
    requiredClaims: ["exp", "iat", "sub"],
  });
  if (
    !payload.sub ||
    payload.role !== "Support.Agent" ||
    typeof payload.name !== "string"
  )
    throw Error("Ungültige Spieleridentität");
  return { id: payload.sub, name: payload.name.slice(0, 48) };
}
