export function calcAge(birthDateISO: string, asOfISO: string): number {
  const birth = new Date(birthDateISO);
  const asOf = new Date(asOfISO);
  let age = asOf.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > birth.getMonth() ||
    (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function isWithinWindow(
  asOfISO: string,
  startISO: string,
  endISO: string | null
): "before" | "within" | "after" {
  const asOf = new Date(asOfISO).getTime();
  const start = new Date(startISO).getTime();
  if (asOf < start) return "before";
  if (endISO === null) return "within";
  const end = new Date(endISO).getTime();
  return asOf > end ? "after" : "within";
}
